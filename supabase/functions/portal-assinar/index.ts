/**
 * Portal — registrar assinatura (público, sem autenticação).
 *
 * O cliente confirma a assinatura enviando o traço do canvas (PNG em dataURL).
 * Esta função, com service_role:
 *   1. revalida o token e o marca como USADO de forma atômica (uso único);
 *   2. sobe o PNG num bucket PRIVADO (`assinaturas`);
 *   3. insere a assinatura vinculada ao documento da entrega;
 *   4. grava a auditoria.
 *
 * O provedor Clicksign segue mockado (metodo = CANVAS); a validade jurídica da
 * assinatura eletrônica se apoia na MP 2.200-2/2001.
 *
 * Deploy: `supabase functions deploy portal-assinar`  (verify_jwt = false)
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

/** Decodifica um dataURL/base64 de PNG em bytes. */
function pngBytes(pngBase64: string): Uint8Array {
  const b64 = pngBase64.includes(',') ? pngBase64.split(',')[1] : pngBase64;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface Body {
  token?: string;
  pngBase64?: string;
  geo?: { lat: number; lng: number } | null;
  userAgent?: string;
}

const INVALIDO = { ok: false } as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(INVALIDO);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(INVALIDO);
  }
  const token = String(body.token ?? '');
  const png = String(body.pngBase64 ?? '');
  if (!token || !png) return json(INVALIDO);

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

    if (!tok) return json(INVALIDO);
    if (tok.used_at !== null) return json(INVALIDO);
    if (new Date(tok.expires_at).getTime() <= Date.now()) return json(INVALIDO);

    // Documento (Confissão) da entrega — assinaturas.documento_id é NOT NULL.
    const { data: doc } = await admin
      .from('documentos')
      .select('id')
      .eq('entrega_id', tok.entrega_id)
      .order('gerado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) return json(INVALIDO);

    // Marca como usado de forma atômica: só prossegue se ESTA chamada venceu a
    // corrida (used_at ainda null). Evita assinatura dupla no mesmo token.
    const { data: usado, error: usoErr } = await admin
      .from('access_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tok.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle();
    if (usoErr) throw usoErr;
    if (!usado) return json(INVALIDO); // outra requisição já usou o token

    // Sobe o PNG no bucket privado.
    const path = `entregas/${tok.entrega_id}/assinatura.png`;
    const { error: upErr } = await admin.storage
      .from('assinaturas')
      .upload(path, pngBytes(png), { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;

    // Registra a assinatura (Clicksign mock → metodo CANVAS).
    const { error: assErr } = await admin.from('assinaturas').insert({
      entrega_id: tok.entrega_id,
      documento_id: doc.id,
      canvas_png_path: path,
      metodo: 'CANVAS',
      ip: null,
      user_agent: body.userAgent ?? null,
      geo: body.geo ?? null,
      assinada_em: new Date().toISOString(),
    });
    if (assErr) throw assErr;

    await admin.from('audit_log').insert({
      actor: 'cliente:token',
      action: 'ASSINATURA_REGISTRADA',
      entity: 'entrega',
      entity_id: tok.entrega_id,
      metadata: { metodo: 'CANVAS' },
    });

    return json({ ok: true, entregaId: tok.entrega_id });
  } catch (e) {
    console.error('[portal-assinar]', e);
    return json(INVALIDO);
  }
});
