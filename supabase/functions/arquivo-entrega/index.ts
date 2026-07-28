// Supabase Edge Function (Deno) — URL assinada para os arquivos de uma entrega.
//
// Recebe POST { entregaId, alvo } e devolve uma URL temporária para o arquivo
// pedido: o traço da assinatura (`assinatura`) ou o PDF de um termo (o tipo do
// documento). Os buckets são PRIVADOS e não têm policy de storage — só o
// service_role lê, e é por isso que a URL precisa ser assinada aqui.
//
// O caminho do arquivo NUNCA vem do cliente: ele é lido do banco a partir do id
// da entrega. Aceitar caminho por parâmetro daria acesso a qualquer objeto do
// bucket para quem editasse a requisição.
//
// Deploy:
//   supabase functions deploy arquivo-entrega
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

/** Validade curta: a URL costuma ser aberta na hora em que é pedida. */
const VALIDADE_SEGUNDOS = 300;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  // Só equipe interna: os arquivos trazem assinatura e dados do cliente.
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('papel')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!roleRow) return json({ error: 'forbidden' }, 403);

  let body: { entregaId?: unknown; alvo?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const entregaId = String(body.entregaId ?? '').trim();
  const alvo = String(body.alvo ?? '').trim();
  if (!entregaId || !alvo) return json({ error: 'entregaId e alvo são obrigatórios' }, 400);

  const { data: ent } = await admin
    .from('entregas')
    .select('id')
    .eq('external_ref', entregaId)
    .maybeSingle();
  if (!ent) return json({ error: 'entrega não encontrada' }, 404);

  let bucket: string;
  let caminho: string | null = null;

  if (alvo === 'assinatura') {
    bucket = 'assinaturas';
    // A mais recente vence: reassinar substitui o arquivo, mas pode haver linha
    // antiga apontando para um caminho anterior.
    const { data } = await admin
      .from('assinaturas')
      .select('canvas_png_path, created_at')
      .eq('entrega_id', ent.id)
      .not('canvas_png_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    caminho = data?.canvas_png_path ?? null;
    if (!caminho) return json({ error: 'assinatura_ausente' }, 404);
  } else {
    bucket = 'documentos';
    const { data } = await admin
      .from('documentos')
      .select('storage_path')
      .eq('entrega_id', ent.id)
      .eq('tipo', alvo)
      .maybeSingle();
    caminho = data?.storage_path ?? null;
    if (!caminho) return json({ error: 'documento_ausente' }, 404);
  }

  const { data: assinada, error: urlErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(caminho, VALIDADE_SEGUNDOS);
  if (urlErr || !assinada?.signedUrl) {
    // O registro existe mas o arquivo não está no bucket — acontece com termos
    // cujo PDF ainda não foi gerado. Merece resposta própria: quem chama decide
    // se cai para a renderização em tela.
    return json({ error: 'arquivo_ausente', detalhe: urlErr?.message ?? caminho }, 404);
  }

  return json({ url: assinada.signedUrl, expiraEm: VALIDADE_SEGUNDOS }, 200);
});
