// Supabase Edge Function (Deno) — proxy seguro para os chamados de assistência
// do CV CRM (GET /api/v1/cv/assistencia).
//
// Volume: o CV devolve ~10 mil chamados (~9 MB) e NÃO filtra por situação,
// empreendimento ou data. Por isso a função lê tudo do CV, guarda em cache na
// memória do worker (TTL curto) e filtra/pagina AQUI; o navegador recebe só a
// página pedida + contagens. Query: ?fluxo&fase&situacaoId&empreendimentoId&
// busca&pagina&porPagina (ver _shared/assistencia.ts) e ?atualizar=1 para
// ignorar o cache.
//
// Paginação no CV: `limit`/`offset` funcionam, mas com `limit` o campo `total`
// vem como a quantidade de PÁGINAS DEVOLVIDAS (sempre 1) — não serve de
// critério de parada. Paramos quando um lote vem menor que o limite — e um
// offset além do fim devolve 400 "Nenhum dado encontrado!", tratado como vazio.
//
// Autenticação no CV: headers `email`/`token`; se recusados (401/403) e houver
// senha, cai para Bearer v3. Nenhum segredo vai para o navegador.
//
// Secrets: CRM_API_EMAIL, CRM_API_TOKEN (ou CRM_API_SENHA/CRM_API_PAINEL) e
// CRM_API_BASE_URL (a origem é usada para montar a URL) ou CRM_API_ASSISTENCIA_URL.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  type ChamadoAssistencia,
  faseDoChamado,
  filtrarChamados,
  filtroDeQuery,
  interpretarSituacao,
} from '../_shared/assistencia.ts';

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

const CACHE_TTL_MS = 5 * 60_000;
const LOTE = 1000;
const LOTES_EM_PARALELO = 4;
const MAX_LOTES = 200; // trava contra laço infinito (200 mil chamados)

let cache: { chamados: ChamadoAssistencia[]; lidoEm: number } | null = null;
// Leitura em andamento: requisições simultâneas compartilham a mesma carga.
let cargaEmAndamento: Promise<{ chamados: ChamadoAssistencia[]; lidoEm: number }> | null = null;

// Bearer v3 em memória do worker (mesma lógica do crm-cliente).
let tokenCache: { valor: string; expiraEm: number } | null = null;

async function loginV3(origem: string, email: string, senha: string, painel: string): Promise<string> {
  const agora = Date.now();
  if (tokenCache && tokenCache.expiraEm > agora + 60_000) return tokenCache.valor;

  const urlLogin = Deno.env.get('CRM_API_AUTH_URL') ?? `${origem}/api/v3/auth/token`;
  const resp = await fetch(urlLogin, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, senha, painel }),
  });
  const corpo = await resp.text();
  if (!resp.ok) throw new Error(`Falha no login v3 do CV (${resp.status})`);

  const raw = JSON.parse(corpo) as { access_token?: unknown; expires_in?: unknown; data?: Record<string, unknown> };
  const payload = (raw.data ?? raw) as { access_token?: unknown; expires_in?: unknown };
  const valor = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!valor) throw new Error('Login v3 do CV não retornou access_token');
  tokenCache = { valor, expiraEm: agora + (Number(payload.expires_in) || 21600) * 1000 };
  return valor;
}

interface CvAssistencia {
  idassistencia?: number | string;
  situacao?: string | null;
  idsituacao?: number | string | null;
  idatendimento?: string | number | null;
  cadastro?: string | null;
  descricao?: string | null;
  parecer_tecnico?: string | null;
  protocolo_atendimento?: string | null;
  sla_assistencia_vencido?: boolean | string | number | null;
  localidade?: string | null;
  area_comum?: string | null;
  empreendimento?: { idempreendimento?: number | string; nome?: string | null; data_entrega?: string | null } | null;
  bloco?: { idbloco?: number | string; nome?: string | null } | null;
  unidade?: { idunidade?: number | string; nome?: string | null; codigo_interno?: string | null } | null;
  cliente?: { nome?: string | null; email?: string | null; documento?: string | null } | null;
  sindico?: string | null;
}

const texto = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const idTexto = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

/** "2026-09-10 14:32:00" → "2026-09-10T14:32:00" (hora local, sem fuso). */
function toIsoLocal(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}T${br[4] ?? '00:00:00'}`;
  return v.trim().replace(' ', 'T');
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'S';
}

function mapear(a: CvAssistencia): ChamadoAssistencia {
  const { fluxo, etapa, nome } = interpretarSituacao(texto(a.situacao) ?? 'Sem situação');
  return {
    id: String(a.idassistencia ?? ''),
    protocolo: texto(a.protocolo_atendimento),
    atendimentoId: idTexto(a.idatendimento),
    fluxo,
    etapa,
    situacao: nome,
    situacaoId: idTexto(a.idsituacao),
    fase: faseDoChamado(fluxo, etapa, nome),
    abertoEm: toIsoLocal(a.cadastro),
    descricao: texto(a.descricao) ?? '',
    parecerTecnico: texto(a.parecer_tecnico),
    slaVencido: toBool(a.sla_assistencia_vencido),
    localidade: texto(a.localidade),
    areaComum: texto(a.area_comum),
    empreendimento: a.empreendimento
      ? {
          id: idTexto(a.empreendimento.idempreendimento),
          nome: texto(a.empreendimento.nome) ?? '',
          dataEntrega: toIsoLocal(a.empreendimento.data_entrega),
        }
      : null,
    bloco: texto(a.bloco?.nome),
    unidade: a.unidade
      ? {
          id: idTexto(a.unidade.idunidade),
          nome: texto(a.unidade.nome) ?? '',
          codigoInterno: texto(a.unidade.codigo_interno),
        }
      : null,
    cliente: a.cliente
      ? {
          nome: texto(a.cliente.nome) ?? '',
          email: texto(a.cliente.email),
          documento: texto(a.cliente.documento),
        }
      : null,
    sindico: texto(a.sindico),
  };
}

class ErroCv extends Error {}

async function carregarDoCv(): Promise<{ chamados: ChamadoAssistencia[]; lidoEm: number }> {
  const baseCrm = Deno.env.get('CRM_API_BASE_URL');
  const endpoint =
    Deno.env.get('CRM_API_ASSISTENCIA_URL') ??
    (baseCrm ? `${new URL(baseCrm).origin}/api/v1/cv/assistencia` : null);
  const email = Deno.env.get('CRM_API_EMAIL');
  const token = Deno.env.get('CRM_API_TOKEN');
  const senha = Deno.env.get('CRM_API_SENHA');
  const painel = Deno.env.get('CRM_API_PAINEL') ?? 'gestor';
  if (!endpoint || !email || (!token && !senha)) {
    throw new ErroCv('CRM (assistência) não configurado no servidor');
  }
  const origem = new URL(endpoint).origin;

  let usarBearer = !token;
  const buscar = async (alvo: string): Promise<Response> => {
    if (!usarBearer) {
      const r = await fetch(alvo, { headers: { email, token: token!, accept: 'application/json' } });
      if ((r.status !== 401 && r.status !== 403) || !senha) return r;
      usarBearer = true; // CV recusou email/token: passa a usar Bearer v3
    }
    const bearer = await loginV3(origem, email, senha!, painel);
    let r = await fetch(alvo, { headers: { authorization: `Bearer ${bearer}`, accept: 'application/json' } });
    if (r.status === 401) {
      tokenCache = null; // token vencido/invalidado por outro login
      const novo = await loginV3(origem, email, senha!, painel);
      r = await fetch(alvo, { headers: { authorization: `Bearer ${novo}`, accept: 'application/json' } });
    }
    return r;
  };

  const lerLote = async (indice: number): Promise<CvAssistencia[]> => {
    const alvo = new URL(endpoint);
    alvo.searchParams.set('limit', String(LOTE));
    alvo.searchParams.set('offset', String(indice * LOTE));
    const resp = await buscar(alvo.toString());
    const corpo = await resp.text();
    if (!resp.ok) {
      // Offset além do fim NÃO volta lista vazia: o CV responde
      // 400 {"error":"Nenhum dado encontrado!"}. Isso é o fim da leitura.
      if (resp.status === 400 && /nenhum dado encontrado/i.test(corpo)) return [];
      let motivo = '';
      try {
        const e = JSON.parse(corpo) as { error?: unknown; message?: unknown };
        motivo = String(e.error ?? e.message ?? '');
      } catch {
        motivo = corpo.slice(0, 200);
      }
      throw new ErroCv(`CRM respondeu ${resp.status}${motivo ? `: ${motivo}` : ''}`);
    }
    const raw = JSON.parse(corpo) as { assistencias?: CvAssistencia[] };
    return Array.isArray(raw?.assistencias) ? raw.assistencias : [];
  };

  const porId = new Map<string, ChamadoAssistencia>();
  let terminou = false;
  for (let inicio = 0; !terminou && inicio < MAX_LOTES; inicio += LOTES_EM_PARALELO) {
    const indices = Array.from({ length: LOTES_EM_PARALELO }, (_, i) => inicio + i);
    const lotes = await Promise.all(indices.map(lerLote));
    for (const lote of lotes) {
      for (const a of lote) {
        const c = mapear(a);
        if (c.id) porId.set(c.id, c);
      }
      if (lote.length < LOTE) terminou = true;
    }
  }

  return { chamados: [...porId.values()], lidoEm: Date.now() };
}

async function obterChamados(forcar: boolean): Promise<{ chamados: ChamadoAssistencia[]; lidoEm: number }> {
  if (!forcar && cache && Date.now() - cache.lidoEm < CACHE_TTL_MS) return cache;
  if (cargaEmAndamento) return cargaEmAndamento;
  const p = carregarDoCv();
  cargaEmAndamento = p;
  try {
    cache = await p;
    return cache;
  } finally {
    if (cargaEmAndamento === p) cargaEmAndamento = null;
  }
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

  const params = new URL(req.url).searchParams;
  try {
    const { chamados, lidoEm } = await obterChamados(params.get('atualizar') === '1');
    const pagina = filtrarChamados(chamados, filtroDeQuery(params), new Date(lidoEm).toISOString());
    return json(pagina, 200);
  } catch (e) {
    const status = e instanceof ErroCv ? 502 : 500;
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o CRM' }, status);
  }
});
