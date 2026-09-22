// Supabase Edge Function (Deno) — proxy seguro para o mapa de disponibilidade do CV CRM.
//
// Chama GET {CRM_API_UNIDADES_BASE_URL}/{idEmpreendimento} com os headers
// `email`/`token` (secrets do servidor), pagina até o fim e devolve as unidades
// já mapeadas para o formato do app, com a `situacao` de venda do CV traduzida
// para o enum de status de unidade.
//
// O ciclo de ENTREGA (QUITADA/LIBERADA/ENTREGUE) NÃO vem do CV — ele é
// controlado localmente no app; aqui só produzimos o baseline de venda
// (DISPONIVEL/VENDIDA/EM_OBRAS).
//
// Endpoint: CRM_API_UNIDADES_BASE_URL, ou — se ausente — a origem de
// CRM_API_BASE_URL + /api/v1/comercial/mapadisponibilidade (mesmo padrão do
// crm-assistencias). O secret próprio nunca chegou a ser cadastrado em produção,
// e a função falhava sempre com "não configurado".
//
// Deploy:
//   npx supabase functions deploy crm-unidades
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

// Situação de venda do CV → status de unidade do app. O ciclo de entrega é
// aplicado localmente por cima deste baseline.
function mapSituacao(situacao: unknown): 'EM_OBRAS' | 'DISPONIVEL' | 'VENDIDA' {
  const s = String(situacao ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (s.includes('bloque')) return 'EM_OBRAS';
  if (s.includes('vend') || s.includes('reserv') || s.includes('processo')) return 'VENDIDA';
  return 'DISPONIVEL';
}

interface CrmUnidade {
  idunidade?: number | string;
  idunidade_int?: string;
  unidade?: string;
  bloco?: string | null;
  etapa?: string | null;
  situacao?: string | null;
  motivo_bloqueio?: string | null;
  area_privativa?: number | string | null;
}

interface CrmMapaResposta {
  paginacao?: { pagina?: number; total_de_paginas?: number };
  dados?: CrmUnidade[];
}

// Junta etapa/bloco/unidade numa identificação legível, ignorando vazios.
function identificacao(u: CrmUnidade): string {
  return [u.etapa, u.bloco, u.unidade]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter((p) => p.length > 0)
    .join(' · ');
}

function toArea(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

  const baseCrm = Deno.env.get('CRM_API_BASE_URL');
  const baseUrl =
    Deno.env.get('CRM_API_UNIDADES_BASE_URL') ??
    (baseCrm ? `${new URL(baseCrm).origin}/api/v1/comercial/mapadisponibilidade` : null);
  const email = Deno.env.get('CRM_API_EMAIL');
  const token = Deno.env.get('CRM_API_TOKEN');
  if (!baseUrl || !email || !token) {
    return json({ error: 'CRM (unidades) não configurado no servidor' }, 500);
  }

  // O id do empreendimento vem em ?empreendimentoId=... (query) — nunca uma URL
  // do cliente: montamos o endpoint a partir da base allow-listed (SSRF/8.4).
  const url = new URL(req.url);
  const empreendimentoId = (url.searchParams.get('empreendimentoId') ?? '').trim();
  if (!/^\d+$/.test(empreendimentoId)) {
    return json({ error: 'empreendimentoId inválido' }, 400);
  }

  const base = baseUrl.replace(/\/+$/, '');
  const headers = { email, token, accept: 'application/json' };

  try {
    const todas: CrmUnidade[] = [];
    let pagina = 1;
    const MAX_PAGINAS = 200; // trava de segurança contra laço infinito
    for (; pagina <= MAX_PAGINAS; pagina += 1) {
      const alvo = `${base}/${empreendimentoId}?pag=${pagina}&limitePagina=500`;
      const resp = await fetch(alvo, { headers });
      if (!resp.ok) return json({ error: `CRM respondeu ${resp.status}` }, 502);

      const raw = (await resp.json()) as CrmMapaResposta;
      const lote = Array.isArray(raw?.dados) ? raw.dados : [];
      todas.push(...lote);

      const totalPaginas = raw?.paginacao?.total_de_paginas ?? 1;
      if (lote.length === 0 || pagina >= totalPaginas) break;
    }

    const agora = new Date().toISOString();
    const mapped = todas.map((u) => ({
      id: String(u.idunidade ?? u.idunidade_int ?? ''),
      cvUnidadeId: String(u.idunidade ?? u.idunidade_int ?? ''),
      situacaoCv: u.situacao?.trim() || null,
      motivoBloqueioCv: u.motivo_bloqueio?.trim() || null,
      empreendimentoId,
      identificacao: identificacao(u) || String(u.unidade ?? u.idunidade ?? ''),
      status: mapSituacao(u.situacao),
      areaM2: toArea(u.area_privativa),
      createdAt: agora,
    }));

    return json(mapped, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o CRM' }, 500);
  }
});
