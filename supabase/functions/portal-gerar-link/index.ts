/**
 * Portal — gerar link de assinatura (durável, server-side).
 *
 * O admin autenticado envia um snapshot mínimo da entrega (empreendimento,
 * unidade, cliente) e a função, com service_role:
 *   1. resolve a identidade e o papel a partir do JWT (nunca do body);
 *   2. faz upsert idempotente do grafo por `external_ref` (os ids vêm do
 *      CV/Mega/mock e não são uuid);
 *   3. garante um documento (Confissão de Dívida) para a entrega;
 *   4. gera um token de 256 bits, grava APENAS o hash em access_tokens
 *      (invalidando tokens anteriores da mesma entrega) e devolve o token em
 *      claro — que só existe no link enviado ao cliente.
 *
 * Segurança (8.2): o token em claro nunca é persistido; o portal do cliente
 * valida via Edge Functions (service_role), nunca com a anon key.
 *
 * Deploy: `supabase functions deploy portal-gerar-link`  (verify_jwt = true)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** base64url (sem padding) de bytes — seguro para URL. */
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 (hex) de uma string. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const HASH_PLACEHOLDER = 'a'.repeat(64);
const TITULO_CONFISSAO = 'Termo de Confissão de Dívida';

interface Snapshot {
  entrega?: { externalRef?: string };
  empreendimento?: { externalRef?: string; nome?: string; cidade?: string; uf?: string };
  unidade?: {
    externalRef?: string;
    identificacao?: string;
    areaM2?: number | null;
    status?: string;
  };
  cliente?: {
    externalRef?: string;
    nome?: string;
    cpf?: string;
    email?: string;
    telefone?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Identidade a partir do JWT (nunca do body).
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // Papel: precisa ser equipe interna (admin OU equipe_entrega).
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('papel')
    .eq('user_id', userId)
    .maybeSingle();
  if (!roleRow) return json({ error: 'forbidden' }, 403);

  let snap: Snapshot;
  try {
    snap = (await req.json()) as Snapshot;
  } catch {
    return json({ error: 'bad_request', message: 'JSON inválido' }, 400);
  }

  const empRef = snap.empreendimento?.externalRef?.trim();
  const uniRef = snap.unidade?.externalRef?.trim();
  const cliRef = snap.cliente?.externalRef?.trim();
  const entRef = snap.entrega?.externalRef?.trim();
  if (!empRef || !uniRef || !cliRef || !entRef) {
    return json({ error: 'bad_request', message: 'Snapshot incompleto (external_ref ausente)' }, 400);
  }

  try {
    // 1) Empreendimento (upsert por external_ref).
    const { data: emp, error: empErr } = await admin
      .from('empreendimentos')
      .upsert(
        {
          external_ref: empRef,
          nome: snap.empreendimento?.nome ?? 'Empreendimento',
          cidade: snap.empreendimento?.cidade ?? '',
          uf: (snap.empreendimento?.uf ?? '').slice(0, 2) || 'PR',
        },
        { onConflict: 'external_ref' },
      )
      .select('id')
      .single();
    if (empErr) throw empErr;

    // 2) Unidade (upsert por external_ref).
    const area = typeof snap.unidade?.areaM2 === 'number' && snap.unidade.areaM2 > 0
      ? snap.unidade.areaM2
      : null;
    const { data: uni, error: uniErr } = await admin
      .from('unidades')
      .upsert(
        {
          external_ref: uniRef,
          empreendimento_id: emp.id,
          identificacao: snap.unidade?.identificacao ?? '—',
          status: (snap.unidade?.status as string) ?? 'LIBERADA',
          area_m2: area,
        },
        { onConflict: 'external_ref' },
      )
      .select('id')
      .single();
    if (uniErr) throw uniErr;

    // 3) Cliente (upsert por external_ref). CPF: só dígitos, senão vazio.
    const cpf = (snap.cliente?.cpf ?? '').replace(/\D/g, '');
    const { data: cli, error: cliErr } = await admin
      .from('clientes')
      .upsert(
        {
          external_ref: cliRef,
          nome: snap.cliente?.nome ?? 'Cliente',
          cpf: cpf.length === 11 ? cpf : '',
          email: snap.cliente?.email ?? '',
          telefone: snap.cliente?.telefone ?? '',
        },
        { onConflict: 'external_ref' },
      )
      .select('id')
      .single();
    if (cliErr) throw cliErr;

    // 4) Entrega.
    //
    // O status NÃO é tocado quando a entrega já existe. Gerar um link de
    // assinatura não é avançar etapa — e desde que a confissão de dívida virou
    // etapa própria, forçar 'ASSINATURA' aqui violava o guard de transição
    // (DOCUMENTOS → ASSINATURA deixou de ser válido), derrubando a geração do
    // link com um erro que chegava à tela como "Falha ao gerar o link".
    //
    // Em INSERT o status vem do app (o snapshot carrega a etapa em que a
    // entrega está); sem ele, o default da coluna vale.
    const { data: entExistente } = await admin
      .from('entregas')
      .select('id')
      .eq('external_ref', entRef)
      .maybeSingle();

    let ent: { id: string };
    if (entExistente) {
      const { data, error } = await admin
        .from('entregas')
        .update({ unidade_id: uni.id, cliente_id: cli.id })
        .eq('external_ref', entRef)
        .select('id')
        .single();
      if (error) throw error;
      ent = data;
    } else {
      const statusInicial = typeof snap.entrega?.status === 'string' ? snap.entrega.status : null;
      const { data, error } = await admin
        .from('entregas')
        .insert({
          external_ref: entRef,
          unidade_id: uni.id,
          cliente_id: cli.id,
          responsavel_id: userId,
          ...(statusInicial ? { status: statusInicial } : {}),
          iniciada_em: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      ent = data;
    }

    // 5) Documento (Confissão de Dívida) — garante um registro para a assinatura.
    const { data: docExistente } = await admin
      .from('documentos')
      .select('id')
      .eq('entrega_id', ent.id)
      .eq('tipo', TITULO_CONFISSAO)
      .maybeSingle();
    if (!docExistente) {
      const { error: docErr } = await admin.from('documentos').insert({
        entrega_id: ent.id,
        tipo: TITULO_CONFISSAO,
        storage_path: `entregas/${ent.id}/confissao-divida.pdf`,
        sha256_hash: HASH_PLACEHOLDER,
      });
      if (docErr) throw docErr;
    }

    // 6) Token: gera 256 bits, grava só o hash. Invalida tokens anteriores da
    //    entrega (uso único + escopo mínimo).
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = toBase64Url(bytes);
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

    await admin.from('access_tokens').delete().eq('entrega_id', ent.id);
    const { error: tokErr } = await admin.from('access_tokens').insert({
      entrega_id: ent.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      scope: 'assinatura',
    });
    if (tokErr) throw tokErr;

    await admin.from('audit_log').insert({
      actor: userId,
      action: 'LINK_ASSINATURA_GERADO',
      entity: 'entrega',
      entity_id: ent.id,
      metadata: {},
    });

    return json({ token, entregaId: ent.id });
  } catch (e) {
    console.error('[portal-gerar-link]', e);
    return json({ error: 'internal', message: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
