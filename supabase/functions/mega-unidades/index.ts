// Supabase Edge Function (Deno) — proxy seguro para a view de parcelas do Mega
// no Microsoft Fabric (GraphQL): `trusted_mega_cli_vw_car_parcelas`.
//
// Recebe POST { empreendimentoId, empreendimentoNome }, autentica no Fabric via
// OAuth client_credentials (secrets do servidor), filtra a view pelo NOME do
// empreendimento (é assim que CV↔Mega se cruzam — a view não conhece o id do
// CV), pagina até o fim, DEDUPLICA as parcelas em unidades e devolve cada
// unidade com contrato/cliente agregados.
//
// Formato dos nomes no Mega: "PORTO SABIÁ - PORTO SABIÁ" (segmentos separados
// por " - "; o do CV é um segmento, ex. "PORTO SABIÁ"). O filtro server-side é
// `contains` e o pós-filtro exige igualdade de segmento normalizado — sem isso
// "PORTO TINGUI I" também casaria com "PORTO TINGUI II".
//
// Só unidades COM CONTRATO existem nessa view; o baseline de status é sempre
// VENDIDA. O ciclo de entrega (QUITADA/LIBERADA/ENTREGUE) é controlado
// localmente no app, por cima deste baseline.
//
// Deploy:
//   supabase secrets set FABRIC_TENANT_ID=... FABRIC_CLIENT_ID=... FABRIC_CLIENT_SECRET=...
//   supabase functions deploy mega-unidades
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

// Endpoint allow-listed (SSRF/8.4) — não é segredo; constante evita drift de config.
const FABRIC_GRAPHQL_URL =
  'https://3dc154996f43476b8430a87719762784.z3d.graphql.fabric.microsoft.com/v1/workspaces/3dc15499-6f43-476b-8430-a87719762784/graphqlapis/d1d7cd32-f9d4-495d-bc1c-ba420069f618/graphql';

// Nome do campo de query confirmado em 2026-07-07 (sem `s` extra de pluralização).
const VIEW = 'trusted_mega_cli_vw_car_parcelas';

// ---------------------------------------------------------------------------
// Token OAuth (client_credentials) com cache em memória do isolate. O token
// AAD vale ~60 min; buscar a cada request custaria 300–1000 ms por navegação.
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getFabricToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60_000) {
    return cachedToken.token;
  }
  const tenant = Deno.env.get('FABRIC_TENANT_ID');
  const clientId = Deno.env.get('FABRIC_CLIENT_ID');
  const secret = Deno.env.get('FABRIC_CLIENT_SECRET');
  if (!tenant || !clientId || !secret) {
    throw new Error('Fabric não configurado no servidor (FABRIC_TENANT_ID/CLIENT_ID/CLIENT_SECRET)');
  }
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: secret,
      scope: 'https://analysis.windows.net/powerbi/api/.default',
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth Microsoft falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cachedToken.token;
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------
interface GraphQLPage<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: string | null;
}

async function fabricQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  rootField: string = VIEW,
): Promise<GraphQLPage<T>> {
  let token = await getFabricToken();
  for (let tentativa = 0; ; tentativa += 1) {
    const res = await fetch(FABRIC_GRAPHQL_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401 && tentativa === 0) {
      token = await getFabricToken(true); // refresh forçado, re-tenta UMA vez
      continue;
    }
    if (!res.ok) {
      throw new Error(`Fabric respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      data?: Record<string, GraphQLPage<T>>;
      errors?: { message: string }[];
    };
    if (body.errors?.length) {
      throw new Error(`Fabric GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
    }
    const page = body.data?.[rootField];
    if (!page) throw new Error(`View "${rootField}" ausente na resposta do Fabric`);
    return page;
  }
}

/** Pagina uma query por cursor até o fim (com trava de segurança). */
async function fabricQueryAll<T>(
  query: string,
  variables: Record<string, unknown>,
  rootField: string = VIEW,
): Promise<T[]> {
  const MAX_PAGES = 50;
  const todas: T[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < MAX_PAGES; pagina += 1) {
    const page = await fabricQuery<T>(query, { ...variables, cursor }, rootField);
    todas.push(...page.items);
    if (!page.hasNextPage || !page.endCursor) break;
    cursor = page.endCursor;
  }
  return todas;
}

// ---------------------------------------------------------------------------
// Queries (seleção mínima de campos para reduzir payload)
// ---------------------------------------------------------------------------
interface ParcelaRow {
  FIL_IN_CODIGO: number | null;
  EMPREENDIMENTO: string | null;
  BLOCO: string | null;
  COD_UNIDADE: string | null;
  NOME_UNIDADE: string | null;
  CTO_IN_CODIGO: number | string | null;
  STATUS_CONTRATO: string | null;
  AGN_ST_NOME: string | null;
  DATA_CONTRATO: string | null;
}

// ATENÇÃO (2026-07-07): a paginação por cursor do Fabric CORROMPE com orderBy
// de baixa cardinalidade (BLOCO/COD_UNIDADE repetem milhares de vezes — linhas
// duplicadas/puladas) e TRUNCA em ~1000 linhas sem orderBy nenhum. CTO_IN_CODIGO
// + PARCELA é quase único por linha e pagina de forma estável (validado contra
// filtro eq: mesmas 272 unidades em PORTO TINGUI I).
const Q_PARCELAS_CONTAINS = `query ($cursor: String, $nome: String!) {
  ${VIEW}(
    filter: { EMPREENDIMENTO: { contains: $nome } }
    orderBy: { CTO_IN_CODIGO: ASC, PARCELA: ASC }
    after: $cursor
    first: 1000
  ) {
    items {
      FIL_IN_CODIGO EMPREENDIMENTO BLOCO COD_UNIDADE NOME_UNIDADE
      CTO_IN_CODIGO STATUS_CONTRATO AGN_ST_NOME DATA_CONTRATO
    }
    hasNextPage
    endCursor
  }
}`;

// Aqui a ordenação por EMPREENDIMENTO é proposital: o cursor avança de grupo
// em grupo de nome (pode pular/repetir linhas DENTRO de um grupo, mas nunca
// perde um nome — validado: acha os 34). Ordenar por CTO/PARCELA sem filtro
// repete dados e estoura MAX_PAGES sem cobrir a view.
const Q_EMPREENDIMENTOS = `query ($cursor: String) {
  ${VIEW}(orderBy: { EMPREENDIMENTO: ASC }, after: $cursor, first: 1000) {
    items { EMPREENDIMENTO }
    hasNextPage
    endCursor
  }
}`;

// FIL_IN_CODIGO é Float NESTA view (na vW_EMPREENDIMENTOs o CV_IDEMPREENDIMENTO
// é Int) — tipos conferidos por teste em 2026-07-07; variável com tipo errado
// dá erro de validação (ou pior, retorno vazio silencioso — ver doc do Rottas).
// O filtro leva FIL **e** nome: uma filial inteira pode passar de 50k parcelas
// (FIL 45 = GOLD 1 + GOLD 2 + BELLA VISTA) e estourar a trava de páginas.
const Q_PARCELAS_BY_FIL_NOME = `query ($cursor: String, $fil: Float!, $nome: String!) {
  ${VIEW}(
    filter: { FIL_IN_CODIGO: { eq: $fil }, EMPREENDIMENTO: { eq: $nome } }
    orderBy: { CTO_IN_CODIGO: ASC, PARCELA: ASC }
    after: $cursor
    first: 1000
  ) {
    items {
      FIL_IN_CODIGO EMPREENDIMENTO BLOCO COD_UNIDADE NOME_UNIDADE
      CTO_IN_CODIGO STATUS_CONTRATO AGN_ST_NOME DATA_CONTRATO
    }
    hasNextPage
    endCursor
  }
}`;

// Nomes distintos dentro de uma filial: ordenar por EMPREENDIMENTO faz o cursor
// saltar de grupo em grupo (poucas páginas), mesmo racional do Q_EMPREENDIMENTOS.
const Q_NOMES_BY_FIL = `query ($cursor: String, $fil: Float!) {
  ${VIEW}(
    filter: { FIL_IN_CODIGO: { eq: $fil } }
    orderBy: { EMPREENDIMENTO: ASC }
    after: $cursor
    first: 1000
  ) {
    items { EMPREENDIMENTO }
    hasNextPage
    endCursor
  }
}`;

// ---------------------------------------------------------------------------
// De-para CV ↔ Mega: vW_EMPREENDIMENTOs (CV_IDEMPREENDIMENTO → MEGA_FIL_IN_CODIGO)
// ---------------------------------------------------------------------------
const DEPARA_VIEW = 'vW_EMPREENDIMENTOs';

interface DeParaRow {
  CV_IDEMPREENDIMENTO: number | null;
  CV_EMPREENDIMENTO: string | null;
  MEGA_FIL_IN_CODIGO: number | null;
}

// A tabela toda tem ~65 linhas — cabe numa página, sem paginação (e portanto
// sem as armadilhas de cursor). Cache de 15 min no isolate.
const Q_DEPARA = `query {
  ${DEPARA_VIEW}(first: 1000) {
    items { CV_IDEMPREENDIMENTO CV_EMPREENDIMENTO MEGA_FIL_IN_CODIGO }
    hasNextPage
    endCursor
  }
}`;

let cachedDePara: { rows: DeParaRow[]; expiresAt: number } | null = null;

async function listarDePara(): Promise<DeParaRow[]> {
  if (cachedDePara && cachedDePara.expiresAt > Date.now()) return cachedDePara.rows;
  const page = await fabricQuery<DeParaRow>(Q_DEPARA, {}, DEPARA_VIEW);
  cachedDePara = { rows: page.items, expiresAt: Date.now() + 15 * 60_000 };
  return page.items;
}

// ---------------------------------------------------------------------------
// Cruzamento por nome: contains server-side + igualdade de segmento normalizado
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Nível de match entre um nome do Mega ("PORTO SABIÁ - PORTO SABIÁ") e o alvo
 * do CV ("PORTO SABIÁ"), do mais forte para o mais fraco:
 *   3 = igualdade de segmento;
 *   2 = segmento do Mega é prefixo do CV com fronteira de palavra
 *       ("PORTO AURORA" × "PORTO AURORA CONDOMÍNIO CLUBE");
 *   1 = CV é prefixo do segmento do Mega com fronteira de palavra
 *       ("CAMPOBELLO GOLD" × "CAMPOBELLO GOLD 1");
 *   0 = não casa. A fronteira de palavra impede TINGUI I × TINGUI II.
 * Só o MELHOR nível presente é usado (ver melhoresMatches) — assim
 * "CAMPOBELLO GOLD 2" (CV) fica só com o GOLD 2 (nível 3) e "CAMPOBELLO GOLD"
 * (CV) não engole o GOLD 2 junto com o GOLD 1.
 */
function nivelMatch(megaNome: string | null, alvoNorm: string): number {
  if (!megaNome) return 0;
  let melhor = norm(megaNome) === alvoNorm ? 3 : 0;
  for (const seg of megaNome.split(' - ')) {
    const s = norm(seg);
    if (s === alvoNorm) melhor = Math.max(melhor, 3);
    else if (alvoNorm.startsWith(`${s} `)) melhor = Math.max(melhor, 2);
    else if (s.startsWith(`${alvoNorm} `)) melhor = Math.max(melhor, 1);
  }
  return melhor;
}

/**
 * Filtra os nomes do Mega que casam com o alvo, mantendo só o melhor nível.
 * Em empate no nível 1 (CV prefixo de vários do Mega, ex. GOLD 1 e GOLD 2),
 * fica só o de menor sufixo — o nome "sem número" do CV corresponde à
 * primeira fase.
 */
function melhoresMatches(nomesMega: string[], alvoNorm: string): string[] {
  const niveis = nomesMega.map((n) => nivelMatch(n, alvoNorm));
  const topo = Math.max(0, ...niveis);
  if (topo === 0) return [];
  let escolhidos = nomesMega.filter((_, i) => niveis[i] === topo);
  if (topo === 1 && escolhidos.length > 1) {
    escolhidos = [
      [...escolhidos].sort((a, b) => norm(a).localeCompare(norm(b), 'pt-BR', { numeric: true }))[0]!,
    ];
  }
  return escolhidos;
}

// Nomes distintos de EMPREENDIMENTO na view, cacheados 15 min (o fallback varre
// a view inteira — caro; o cache amortiza navegações consecutivas).
let cachedNomes: { nomes: string[]; expiresAt: number } | null = null;

async function listarNomesMega(): Promise<string[]> {
  if (cachedNomes && cachedNomes.expiresAt > Date.now()) return cachedNomes.nomes;
  const rows = await fabricQueryAll<{ EMPREENDIMENTO: string | null }>(Q_EMPREENDIMENTOS, {});
  const nomes = [...new Set(rows.map((r) => r.EMPREENDIMENTO ?? '').filter(Boolean))];
  cachedNomes = { nomes, expiresAt: Date.now() + 15 * 60_000 };
  return nomes;
}

// ---------------------------------------------------------------------------
// Dedup: 1 unidade por FIL|BLOCO|COD_UNIDADE, preferindo o contrato "vigente"
// ---------------------------------------------------------------------------
const cancelado = (s: unknown): boolean => /cancel|distrat|rescind/i.test(String(s ?? ''));

function dedup(rows: ParcelaRow[]): ParcelaRow[] {
  const porUnidade = new Map<string, ParcelaRow>();
  for (const r of rows) {
    if (r.COD_UNIDADE == null || String(r.COD_UNIDADE).trim() === '') continue;
    // EMPREENDIMENTO entra na chave: um nome do CV pode casar com mais de um
    // do Mega (ex. CAMPOBELLO GOLD 1 e 2), e blocos/códigos se repetem entre
    // eles. O BLOCO entra COMPLETO (prefixo + nome): nem o prefixo é único
    // ("1 - QUADRA 10" e "1 - QUADRA 21") nem o nome legível é
    // ("M1Q2 - QUADRA 2" e "M2Q2 - QUADRA 2" são quadras diferentes).
    const key = `${r.FIL_IN_CODIGO ?? ''}|${r.EMPREENDIMENTO ?? ''}|${slugBloco(r.BLOCO)}|${String(r.COD_UNIDADE).trim()}`;
    const atual = porUnidade.get(key);
    if (!atual) {
      porUnidade.set(key, r);
      continue;
    }
    const melhor =
      (cancelado(atual.STATUS_CONTRATO) && !cancelado(r.STATUS_CONTRATO)) ||
      (cancelado(atual.STATUS_CONTRATO) === cancelado(r.STATUS_CONTRATO) &&
        String(r.DATA_CONTRATO ?? '') > String(atual.DATA_CONTRATO ?? ''));
    if (melhor) porUnidade.set(key, r);
  }
  return [...porUnidade.values()];
}

/** "B1 - BLOCO 1" → "BLOCO 1" (descarta o código antes do primeiro " - "). */
function blocoLegivel(bloco: string | null): string {
  const s = String(bloco ?? '').trim();
  const i = s.indexOf(' - ');
  return i >= 0 ? s.slice(i + 3).trim() : s;
}

/** BLOCO completo normalizado e compacto ("M1Q2 - QUADRA 2" → "M1Q2QUADRA2"). */
function slugBloco(bloco: string | null): string {
  return norm(String(bloco ?? '')).replace(/[^A-Z0-9]/g, '');
}

/** Último segmento de "X - Y" compactado: "CAMPOBELLO GOLD 1 - ..." → "CAMPOBELLOGOLD1". */
function empSlug(nome: string | null): string {
  const partes = String(nome ?? '').split(' - ');
  return norm(partes[partes.length - 1] ?? '').replace(/[^A-Z0-9]/g, '');
}

function mapUnidades(rows: ParcelaRow[], empreendimentoId: string) {
  const agora = new Date().toISOString();
  const deduped = dedup(rows);
  // Um nome do CV pode agregar mais de um empreendimento do Mega (GOLD 1 + 2);
  // nesse caso o nome do Mega entra na identificação para desambiguar.
  const empsDistintos = new Set(deduped.map((r) => r.EMPREENDIMENTO ?? ''));
  const multiEmp = empsDistintos.size > 1;
  // Blocos diferentes podem compartilhar o nome legível ("M1Q2 - QUADRA 2" e
  // "M2Q2 - QUADRA 2"); nesses casos exibe o BLOCO completo para não confundir.
  const blocosPorLegivel = new Map<string, Set<string>>();
  for (const r of deduped) {
    const leg = blocoLegivel(r.BLOCO);
    if (!blocosPorLegivel.has(leg)) blocosPorLegivel.set(leg, new Set());
    blocosPorLegivel.get(leg)!.add(String(r.BLOCO ?? ''));
  }
  return deduped.map((r) => {
    const legivel = blocoLegivel(r.BLOCO);
    const bloco =
      (blocosPorLegivel.get(legivel)?.size ?? 0) > 1 ? String(r.BLOCO ?? '').trim() : legivel;
    // Em alguns empreendimentos o NOME_UNIDADE já vem prefixado com o bloco
    // ("BLOCO R - 204"); tira o prefixo para não duplicar na identificação.
    let nomeUnidade = String(r.NOME_UNIDADE ?? r.COD_UNIDADE ?? '').trim();
    if (legivel && nomeUnidade.startsWith(`${legivel} - `)) {
      nomeUnidade = nomeUnidade.slice(legivel.length + 3).trim();
    }
    return {
      // COD_UNIDADE se repete entre blocos (UN15 existe no bloco A e no B) —
      // bloco e empreendimento entram no id para ele ser único. Mesma
      // normalização de bloco da chave de dedup, para id e dedup coincidirem.
      id: `${Math.trunc(Number(r.FIL_IN_CODIGO ?? 0))}-${empSlug(r.EMPREENDIMENTO)}-${slugBloco(r.BLOCO)}-${String(r.COD_UNIDADE).trim()}`,
      empreendimentoId,
      identificacao: [multiEmp ? blocoLegivel(r.EMPREENDIMENTO) : '', bloco, nomeUnidade]
        .filter((p) => p.length > 0)
        .join(' · '),
      status: 'VENDIDA' as const,
      areaM2: null, // a view de parcelas não tem área
      createdAt: agora,
      contratoNumero:
        r.CTO_IN_CODIGO != null ? String(Math.trunc(Number(r.CTO_IN_CODIGO))) : null,
      clienteNome: r.AGN_ST_NOME?.trim() || null,
      // O Mega já classifica a inadimplência no nível do contrato (valores
      // observados: "Ativo" | "Inadimplente" | "Distratado"). O contrato aqui é
      // o vigente eleito pelo dedup, então basta ler o status dele.
      inadimplente: norm(r.STATUS_CONTRATO ?? '') === 'INADIMPLENTE',
    };
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

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

  let body: { empreendimentoId?: unknown; empreendimentoNome?: unknown; schema?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body JSON inválido' }, 400);
  }

  // Diagnóstico: { "schema": true } devolve os campos da view de parcelas.
  // Serve para descobrir os nomes das colunas monetárias (valor, saldo,
  // vencimento, pago) sem chutar — a query de produção só pede identificação, e
  // o cálculo da dívida depende de saber o que existe ali. Somente leitura.
  if (body.schema === true) {
    try {
      const introspec = `query { __type(name: "${VIEW}") { fields { name type { name kind ofType { name } } } } }`;
      const res = await fetch(FABRIC_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await getFabricToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: introspec }),
      });
      const bruto = (await res.json()) as {
        data?: { __type?: { fields?: { name: string; type?: Record<string, unknown> }[] } };
        errors?: { message: string }[];
      };
      if (bruto.errors?.length) {
        return json({ error: bruto.errors.map((e) => e.message).join('; ') }, 502);
      }
      const campos = (bruto.data?.__type?.fields ?? []).map((f) => ({
        nome: f.name,
        tipo:
          (f.type?.name as string | undefined) ??
          ((f.type?.ofType as { name?: string } | undefined)?.name ?? '?'),
      }));
      return json({ view: VIEW, total: campos.length, campos }, 200);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'falha na introspecção' }, 502);
    }
  }
  const empreendimentoId = String(body.empreendimentoId ?? '').trim();
  const empreendimentoNome = String(body.empreendimentoNome ?? '').trim();
  if (!empreendimentoId || !empreendimentoNome) {
    return json({ error: 'empreendimentoId e empreendimentoNome são obrigatórios' }, 400);
  }

  try {
    let rows: ParcelaRow[] = [];

    // Caminho principal: resolve a filial Mega pelo ID do CV via de-para
    // (vW_EMPREENDIMENTOs) e busca as parcelas por FIL_IN_CODIGO — determinístico,
    // sem depender de igualdade de nomes entre CV e Mega.
    const cvId = /^\d+$/.test(empreendimentoId) ? Number(empreendimentoId) : null;
    const dePara = cvId != null ? await listarDePara() : [];
    const linhaDePara = dePara.find((d) => d.CV_IDEMPREENDIMENTO === cvId) ?? null;

    if (linhaDePara?.MEGA_FIL_IN_CODIGO != null) {
      const fil = linhaDePara.MEGA_FIL_IN_CODIGO;
      // Nomes distintos dentro da filial (poucas páginas), depois as parcelas
      // de cada empreendimento escolhido — buscar a filial inteira estoura a
      // trava de páginas quando ela abriga vários empreendimentos (FIL 45).
      const nomesFil = [
        ...new Set(
          (await fabricQueryAll<{ EMPREENDIMENTO: string | null }>(Q_NOMES_BY_FIL, { fil }))
            .map((r) => r.EMPREENDIMENTO ?? '')
            .filter(Boolean),
        ),
      ];
      // Se a filial é exclusiva no de-para, todos os nomes são dela; senão,
      // desambigua pelo nome canônico do CV vindo do próprio de-para
      // (FIL 45 = GOLD 1, GOLD 2 e BELLA VISTA; FIL 70 = AMPLO PARK 1 e 2).
      const irmaos = dePara.filter((d) => d.MEGA_FIL_IN_CODIGO === fil);
      const escolhidos =
        irmaos.length > 1
          ? melhoresMatches(nomesFil, norm(linhaDePara.CV_EMPREENDIMENTO ?? empreendimentoNome))
          : nomesFil;
      for (const nome of escolhidos) {
        rows.push(...(await fabricQueryAll<ParcelaRow>(Q_PARCELAS_BY_FIL_NOME, { fil, nome })));
      }
    }

    // Fallback (id fora do de-para, ex. dados de teste): matching por nome,
    // contains + melhores matches, e por fim varredura dos nomes distintos.
    if (rows.length === 0 && !linhaDePara) {
      const alvo = norm(empreendimentoNome);
      rows = await fabricQueryAll<ParcelaRow>(Q_PARCELAS_CONTAINS, {
        nome: empreendimentoNome,
      });
      let escolhidos = melhoresMatches(
        [...new Set(rows.map((r) => r.EMPREENDIMENTO ?? '').filter(Boolean))],
        alvo,
      );
      rows = rows.filter((r) => escolhidos.includes(r.EMPREENDIMENTO ?? ''));

      if (rows.length === 0) {
        escolhidos = melhoresMatches(await listarNomesMega(), alvo);
        rows = [];
        for (const canonico of escolhidos) {
          const lote = await fabricQueryAll<ParcelaRow>(Q_PARCELAS_CONTAINS, { nome: canonico });
          rows.push(...lote.filter((r) => r.EMPREENDIMENTO === canonico));
        }
      }
    }

    if (rows.length === 0) {
      console.warn(`[mega-unidades] Empreendimento "${empreendimentoNome}" não encontrado no Mega`);
      return json(
        { unidades: [], aviso: `Empreendimento "${empreendimentoNome}" não encontrado no Mega` },
        200,
      );
    }

    return json({ unidades: mapUnidades(rows, empreendimentoId) }, 200);
  } catch (e) {
    console.error('[mega-unidades]', e);
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o Mega' }, 500);
  }
});
