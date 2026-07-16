// Supabase Edge Function (Deno) — proxy seguro para o CV CRM.
//
// Chama GET {CRM_API_BASE_URL} com os headers `email`/`token` (secrets do
// servidor) e devolve os empreendimentos já mapeados para o formato do app.
// O token do CRM NUNCA vai para o navegador. A função exige JWT válido
// (verify_jwt padrão do Supabase), então só usuários autenticados a invocam.
//
// Deploy:
//   supabase secrets set CRM_API_BASE_URL=... CRM_API_EMAIL=... CRM_API_TOKEN=...
//   supabase functions deploy crm-empreendimentos
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// A API do CV devolve a data como "DD/MM/YYYY". Convertemos para ISO (YYYY-MM-DD)
// para casar com `createdAt: z.string()` e com a formatação de datas do app.
function toIsoDate(v: unknown): string {
  if (typeof v === 'string') {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`;
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

interface CrmSituacaoObra {
  nome?: string | null;
  idsituacao_obra?: number | null;
}

interface CrmEmpreendimento {
  idempreendimento?: number | string;
  idempreendimento_int?: string;
  nome?: string;
  cidade?: string;
  sigla?: string;
  foto?: string | null;
  foto_listagem?: string | null;
  logo?: string | null;
  unidades_disponiveis?: number | string | null;
  // O CV devolve `situacao_obra` como lista de objetos, não como string.
  situacao_obra?: CrmSituacaoObra[] | null;
  data_entrega?: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Autenticação DENTRO da função: com verify_jwt = false no gateway (senão o
  // preflight OPTIONS, que não carrega Authorization, seria barrado), validamos
  // aqui o JWT do usuário interno.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const auth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await auth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  const baseUrl = Deno.env.get('CRM_API_BASE_URL');
  const email = Deno.env.get('CRM_API_EMAIL');
  const token = Deno.env.get('CRM_API_TOKEN');
  if (!baseUrl || !email || !token) {
    return json({ error: 'CRM não configurado no servidor' }, 500);
  }

  try {
    const resp = await fetch(baseUrl, {
      headers: { email, token, accept: 'application/json' },
    });
    if (!resp.ok) return json({ error: `CRM respondeu ${resp.status}` }, 502);

    const raw: unknown = await resp.json();
    const lista: CrmEmpreendimento[] = Array.isArray(raw)
      ? (raw as CrmEmpreendimento[])
      : (((raw as { dados?: CrmEmpreendimento[]; data?: CrmEmpreendimento[] }).dados ??
          (raw as { data?: CrmEmpreendimento[] }).data ??
          []) as CrmEmpreendimento[]);

    const mapped = lista.map((e) => ({
      id: String(e.idempreendimento ?? e.idempreendimento_int ?? ''),
      nome: e.nome ?? '',
      cidade: e.cidade ?? '',
      uf: e.sigla ?? '',
      foto: e.foto ?? e.foto_listagem ?? e.logo ?? null,
      unidadesDisponiveis: toNum(e.unidades_disponiveis),
      situacaoObra: e.situacao_obra?.[0]?.nome ?? null,
      createdAt: toIsoDate(e.data_entrega),
    }));

    return json(mapped, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o CRM' }, 500);
  }
});
