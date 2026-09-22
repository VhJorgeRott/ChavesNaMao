// Supabase Edge Function (Deno) — situação do cliente no CV CRM para a ficha da
// unidade: atendimentos de relacionamento e sinalizador jurídico.
//
// Recebe GET ?documento=CPF/CNPJ e consulta, em paralelo:
//   - /api/v1/relacionamento/atendimentos/listar?documento=...
//   - /api/v1/cadastros/clientes?documento=...  (só o `sinalizador_juridico`
//     sai daqui — o cadastro traz dados sensíveis que NÃO vão ao navegador)
// Ver _shared/situacao-cliente.ts para as peculiaridades da API.
//
// Secrets: CRM_API_EMAIL, CRM_API_TOKEN e CRM_API_BASE_URL (a origem é usada
// para montar as URLs — endpoints allow-listed, SSRF/8.4).
//
// Deploy:
//   npx supabase functions deploy crm-situacao-cliente
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  interpretarSinalizador,
  mapearAtendimento,
  type SituacaoClienteCv,
} from '../_shared/situacao-cliente.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

/** O CV devolve listas cruas ou envelopadas — cobre as duas formas. */
function lista(raw: unknown, chave: string): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const env = (raw ?? {}) as Record<string, unknown>;
  const dentro = env[chave] ?? env.dados;
  return Array.isArray(dentro) ? (dentro as Record<string, unknown>[]) : [];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // verify_jwt = false no gateway (preflight OPTIONS); validamos o JWT aqui.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await auth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  const baseCrm = Deno.env.get('CRM_API_BASE_URL');
  const email = Deno.env.get('CRM_API_EMAIL');
  const token = Deno.env.get('CRM_API_TOKEN');
  if (!baseCrm || !email || !token) {
    return json({ error: 'CRM não configurado no servidor' }, 500);
  }

  const documento = (new URL(req.url).searchParams.get('documento') ?? '').replace(/\D/g, '');
  if (documento.length !== 11 && documento.length !== 14) {
    return json({ error: 'documento inválido' }, 400);
  }

  const origem = new URL(baseCrm).origin;
  const headers = { email, token, accept: 'application/json' };
  const q = `documento=${encodeURIComponent(documento)}`;

  try {
    const [respAt, respCli] = await Promise.all([
      fetch(`${origem}/api/v1/relacionamento/atendimentos/listar?${q}`, { headers }),
      fetch(`${origem}/api/v1/cadastros/clientes?${q}`, { headers }),
    ]);

    // Pessoa sem atendimentos pode vir como 404/400 "nenhum dado" — trata como vazio.
    let atendimentos: SituacaoClienteCv['atendimentos'] = [];
    if (respAt.ok) {
      atendimentos = lista(await respAt.json(), 'atendimentos').map(mapearAtendimento);
    } else if (respAt.status !== 404 && respAt.status !== 400) {
      return json({ error: `CRM (relacionamento) respondeu ${respAt.status}` }, 502);
    }

    let juridico: SituacaoClienteCv['juridico'] = { ativo: null, valor: null };
    if (respCli.ok) {
      const pessoa = lista(await respCli.json(), 'pessoas')[0];
      if (pessoa) {
        const bruto = pessoa.sinalizador_juridico ?? null;
        juridico = {
          ativo: interpretarSinalizador(bruto),
          valor: bruto === null ? null : JSON.stringify(bruto).slice(0, 200),
        };
      }
    }

    atendimentos.sort((a, b) => (b.abertoEm ?? '').localeCompare(a.abertoEm ?? ''));
    const corpo: SituacaoClienteCv = { atendimentos, juridico };
    return json(corpo, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o CRM' }, 500);
  }
});
