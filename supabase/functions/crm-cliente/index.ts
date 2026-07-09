// Supabase Edge Function (Deno) — proxy seguro para o cadastro de pessoas do CV CRM (v3).
//
// Recebe ?documento=... e/ou ?nome=... (query) e consulta o endpoint de pessoas
// da API v3 do CV. A v3 usa Bearer Token temporário (válido por 6h): a função
// faz login em /api/v3/auth/token (email + senha + painel), CACHEIA o token em
// memória e o reutiliza até perto de expirar, renovando também ao receber 401.
// Devolve o cliente já mapeado para o formato do app (id/nome/cpf/email/telefone).
// Nenhum segredo (senha/token) vai para o navegador; a função exige JWT válido.
//
// SEGURANÇA (SSRF/8.4): o endpoint é montado a partir de CRM_API_PESSOAS_BASE_URL
// (allow-listed via secret) e a URL de login é derivada da MESMA origem. Nada da
// URL vem de input livre do usuário — só os valores de busca `documento`/`nome`
// entram como query params escapados.
//
// Secrets necessários:
//   supabase secrets set CRM_API_PESSOAS_BASE_URL=https://rottas.cvcrm.com.br/api/v3/cadastros/pessoas
//   supabase secrets set CRM_API_EMAIL=usuario@empresa.com.br
//   supabase secrets set CRM_API_SENHA=<senha-do-usuario-administrativo>
//   supabase secrets set CRM_API_PAINEL=gestor   # gestor | corretor | imobiliaria (default: gestor)
//   # opcional — só se a URL de login não for {origem}/api/v3/auth/token:
//   supabase secrets set CRM_API_AUTH_URL=https://rottas.cvcrm.com.br/api/v3/auth/token
//   supabase functions deploy crm-cliente

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Cache do Bearer Token em memória do worker. Persiste entre invocações no mesmo
// worker "quente" (cold starts geram novo cache — comportamento aceitável). Evita
// um login a cada requisição, respeitando a validade de 6h da v3.
let tokenCache: { valor: string; expiraEm: number } | null = null;

// Login em andamento (mutex): a v3 do CV invalida o token anterior a cada novo
// login, então logins concorrentes se anulariam. Compartilhando uma única
// Promise, requisições simultâneas usam o mesmo token.
let loginEmAndamento: Promise<string> | null = null;

/** Deriva a URL de login v3 (mesma origem da base allow-listed) ou usa o override. */
function urlLogin(baseUrl: string): string {
  const override = Deno.env.get('CRM_API_AUTH_URL');
  if (override) return override;
  return `${new URL(baseUrl).origin}/api/v3/auth/token`;
}

/**
 * Obtém um Bearer Token válido — do cache quando possível, senão faz login. Passe
 * `forcar=true` para ignorar o cache (ex.: após um 401 = token expirado/revogado).
 */
async function obterBearerToken(
  baseUrl: string,
  email: string,
  senha: string,
  painel: string,
  forcar = false,
): Promise<string> {
  const agora = Date.now();
  // Margem de 60s para não usar um token à beira de expirar.
  if (!forcar && tokenCache && tokenCache.expiraEm > agora + 60_000) {
    return tokenCache.valor;
  }
  // Reaproveita um login já em curso (evita logins concorrentes que se invalidam).
  if (!forcar && loginEmAndamento) return loginEmAndamento;

  const p = (async (): Promise<string> => {
    const resp = await fetch(urlLogin(baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, senha, painel }),
    });
    const corpo = await resp.text();
    if (!resp.ok) {
      throw new Error(`Falha no login v3 do CV (${resp.status}): ${corpo.slice(0, 500)}`);
    }

    // A v3 aninha o token em `data`: { status, data: { access_token, token_type, expires_in } }.
    // `expires_in` costuma vir como string (segundos). Aceitamos também o formato plano.
    let raw: unknown;
    try {
      raw = JSON.parse(corpo);
    } catch {
      throw new Error(`Login v3 do CV retornou resposta não-JSON: ${corpo.slice(0, 300)}`);
    }
    const env = raw as { access_token?: unknown; expires_in?: unknown; data?: Record<string, unknown> };
    const payload = (env.data ?? env) as { access_token?: unknown; expires_in?: unknown };
    const valor = typeof payload.access_token === 'string' ? payload.access_token : '';
    if (!valor) {
      throw new Error(`Login v3 do CV não retornou access_token: ${corpo.slice(0, 300)}`);
    }
    const expiresIn = Number(payload.expires_in) || 21600; // 6h padrão
    tokenCache = { valor, expiraEm: agora + expiresIn * 1000 };
    return valor;
  })();

  loginEmAndamento = p;
  try {
    return await p;
  } finally {
    if (loginEmAndamento === p) loginEmAndamento = null;
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

/** Primeiro valor não-vazio entre várias chaves possíveis do payload do CV. */
function pick(obj: Record<string, unknown>, ...chaves: string[]): string {
  for (const k of chaves) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// Payload de pessoa do CV. Os nomes de campo variam entre módulos do CV, por isso
// o mapeamento abaixo tenta várias chaves. AJUSTE conforme o retorno real do seu
// endpoint (veja o objeto cru logado quando CRM_DEBUG=1).
interface CrmPessoa {
  [k: string]: unknown;
}

/** Extrai a lista de pessoas do retorno do CV. Cobre array direto, envelopes
 * ({ dados|data|registros|pessoas|items|results|rows }) e um nível de aninhamento
 * (ex.: v3 -> { status, data: { dados: [...] } }). */
function extrairLista(raw: unknown): CrmPessoa[] {
  const CHAVES_LISTA = ['dados', 'data', 'registros', 'pessoas', 'items', 'results', 'rows', 'content'];

  const daPrimeiraChave = (o: Record<string, unknown>): CrmPessoa[] | null => {
    for (const k of CHAVES_LISTA) {
      if (Array.isArray(o[k])) return o[k] as CrmPessoa[];
    }
    return null;
  };

  if (Array.isArray(raw)) return raw as CrmPessoa[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const direto = daPrimeiraChave(obj);
    if (direto) return direto;
    // Um nível de aninhamento (ex.: { data: { dados: [...] } }).
    for (const k of CHAVES_LISTA) {
      const filho = obj[k];
      if (filho && typeof filho === 'object' && !Array.isArray(filho)) {
        const aninhada = daPrimeiraChave(filho as Record<string, unknown>);
        if (aninhada) return aninhada;
      }
    }
    // Senão, assume que o próprio objeto é uma única pessoa.
    return [raw as CrmPessoa];
  }
  return [];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const baseUrl = Deno.env.get('CRM_API_PESSOAS_BASE_URL');
  const email = Deno.env.get('CRM_API_EMAIL');
  const senha = Deno.env.get('CRM_API_SENHA');
  const painel = Deno.env.get('CRM_API_PAINEL') ?? 'gestor';
  if (!baseUrl || !email || !senha) {
    return json(
      { error: 'CRM (pessoas) não configurado: defina CRM_API_PESSOAS_BASE_URL, CRM_API_EMAIL e CRM_API_SENHA' },
      500,
    );
  }

  const url = new URL(req.url);
  const documento = (url.searchParams.get('documento') ?? '').replace(/\D/g, '');
  const nome = (url.searchParams.get('nome') ?? '').trim();
  if (!documento && !nome) {
    return json({ error: 'Informe documento ou nome para localizar a pessoa' }, 400);
  }

  // Monta o alvo a partir da base allow-listed + os filtros de busca.
  // ENCAIXE: se o CV usar outros nomes de parâmetro (ex.: `cpf`, `pesquisa`),
  // troque as chaves abaixo pelas do seu endpoint.
  const alvo = new URL(baseUrl.replace(/\/+$/, ''));
  if (documento) alvo.searchParams.set('documento', documento);
  else if (nome) alvo.searchParams.set('nome', nome);

  /** Consulta a v3 de pessoas com o Bearer Token informado. */
  const consultar = (bearer: string): Promise<Response> =>
    fetch(alvo.toString(), {
      headers: {
        Authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
    });

  try {
    let bearer = await obterBearerToken(baseUrl, email, senha, painel);
    let resp = await consultar(bearer);
    // Token expirado/revogado no meio do caminho: renova uma vez e repete.
    if (resp.status === 401) {
      bearer = await obterBearerToken(baseUrl, email, senha, painel, true);
      resp = await consultar(bearer);
    }
    if (!resp.ok) {
      // Expõe o corpo real do CV para diagnóstico (endpoint/param/permissão).
      const corpo = (await resp.text()).slice(0, 800);
      console.error('[crm-cliente] CV respondeu', resp.status, 'para', alvo.toString(), '→', corpo);
      return json({ error: `CRM respondeu ${resp.status}`, alvo: alvo.toString(), detalhe: corpo }, 502);
    }

    const raw: unknown = await resp.json();
    const debug = Deno.env.get('CRM_DEBUG') === '1';
    if (debug) {
      console.log('[crm-cliente] retorno cru do CV:', JSON.stringify(raw).slice(0, 2000));
    }

    const pessoa = extrairLista(raw)[0];
    if (!pessoa) {
      return json(
        {
          error: 'Pessoa não encontrada no CV',
          ...(debug ? { _debug: { raw } } : {}),
        },
        404,
      );
    }

    // ENCAIXE: ajuste as chaves conforme o payload real do CV.
    const cliente = {
      id: pick(pessoa, 'idpessoa', 'idpessoa_int', 'id', 'codigo') || (documento || nome),
      nome: pick(pessoa, 'nome', 'nome_completo', 'razao_social'),
      cpf: pick(pessoa, 'cpf', 'documento', 'cpf_cnpj', 'cnpj'),
      email: pick(pessoa, 'email', 'e_mail', 'email_principal'),
      telefone: pick(pessoa, 'telefone', 'celular', 'telefone_celular', 'fone'),
      createdAt: new Date().toISOString(),
    };

    // Quando o debug está ligado e não conseguimos mapear o nome, devolvemos as
    // chaves reais do objeto pessoa para facilitar o encaixe do mapeamento.
    if (debug && !cliente.nome) {
      return json({ ...cliente, _debug: { chavesPessoa: Object.keys(pessoa), pessoa } }, 200);
    }

    return json(cliente, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro ao consultar o CRM' }, 500);
  }
});
