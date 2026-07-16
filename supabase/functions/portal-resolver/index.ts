/**
 * Portal — resolver token (público, sem autenticação).
 *
 * O cliente abre o link com o token em claro. Esta função, com service_role,
 * valida o token (hash, não usado, não expirado) e devolve um snapshot MÍNIMO
 * de exibição da entrega. Para não vazar a existência de tokens, qualquer falha
 * (inválido/expirado/usado) devolve a MESMA resposta genérica `{ ok: false }`.
 *
 * Deploy: `supabase functions deploy portal-resolver`  (verify_jwt = false)
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

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const INVALIDO = { ok: false } as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(INVALIDO);

  let token = '';
  try {
    token = String(((await req.json()) as { token?: unknown }).token ?? '');
  } catch {
    return json(INVALIDO);
  }
  if (!token) return json(INVALIDO);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const tokenHash = await sha256Hex(token);
    const { data: tok } = await admin
      .from('access_tokens')
      .select('id, entrega_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    // Resposta idêntica para inválido/usado/expirado — não vaza existência.
    if (!tok) return json(INVALIDO);
    if (tok.used_at !== null) return json(INVALIDO);
    if (new Date(tok.expires_at).getTime() <= Date.now()) return json(INVALIDO);

    const { data: ent } = await admin
      .from('entregas')
      .select(
        'id, cliente:clientes(nome, cpf), unidade:unidades(identificacao, area_m2, empreendimento:empreendimentos(nome, cidade, uf))',
      )
      .eq('id', tok.entrega_id)
      .maybeSingle();
    if (!ent) return json(INVALIDO);

    // supabase-js tipa relações "to-one" como array em alguns casos — normaliza.
    const cliente = Array.isArray(ent.cliente) ? ent.cliente[0] : ent.cliente;
    const unidade = Array.isArray(ent.unidade) ? ent.unidade[0] : ent.unidade;
    const empreendimento = unidade
      ? Array.isArray(unidade.empreendimento)
        ? unidade.empreendimento[0]
        : unidade.empreendimento
      : null;

    return json({
      ok: true,
      entregaId: ent.id,
      cliente: { nome: cliente?.nome ?? '', cpf: cliente?.cpf ?? '' },
      unidade: {
        identificacao: unidade?.identificacao ?? '',
        areaM2: unidade?.area_m2 ?? null,
      },
      empreendimento: {
        nome: empreendimento?.nome ?? '',
        cidade: empreendimento?.cidade ?? '',
        uf: empreendimento?.uf ?? '',
      },
    });
  } catch (e) {
    console.error('[portal-resolver]', e);
    // Mesmo em erro interno, não revela detalhes ao cliente.
    return json(INVALIDO);
  }
});
