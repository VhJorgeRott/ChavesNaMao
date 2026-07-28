// Supabase Edge Function (Deno) — envia um termo para assinatura na Clicksign.
//
// Recebe POST { entregaId, tipo }, busca o PDF já gerado no bucket privado e
// executa as cinco chamadas encadeadas da API v3:
//
//   1. POST   /api/v3/envelopes                      → envelope em draft
//   2. POST   /api/v3/envelopes/{id}/documents       → anexa o PDF (base64)
//   3. POST   /api/v3/envelopes/{id}/signers         → cadastra o signatário
//   4. POST   /api/v3/envelopes/{id}/requirements    → qualificação + autenticação
//   5. PATCH  /api/v3/envelopes/{id}                 → status "running" (dispara)
//
// O token vive como secret do servidor e nunca chega ao bundle (SSRF/8.4: a URL
// base é allow-listed por env, nada vem de input do usuário).
//
// MODO DE TESTE: com CLICKSIGN_EMAIL_TESTE definido, TODO e-mail de signatário é
// substituído por esse endereço. É o que permite exercitar o fluxo ponta a ponta
// sem disparar termo para cliente real. Remover a variável ativa o envio real.
//
// Deploy:
//   supabase secrets set CLICKSIGN_API_TOKEN=... CLICKSIGN_API_BASE_URL=https://sandbox.clicksign.com
//   supabase secrets set CLICKSIGN_EMAIL_TESTE=tecnologia@rottasconstrutora.com.br
//   supabase functions deploy clicksign-enviar
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

const JSONAPI = 'application/vnd.api+json';

/** Chamada à Clicksign, com o erro da API preservado (some no `throw` genérico). */
async function clicksign(
  caminho: string,
  metodo: 'POST' | 'PATCH',
  corpo: unknown,
): Promise<Record<string, unknown>> {
  const base = (Deno.env.get('CLICKSIGN_API_BASE_URL') ?? '').replace(/\/+$/, '');
  const token = Deno.env.get('CLICKSIGN_API_TOKEN') ?? '';
  const resp = await fetch(`${base}/api/v3${caminho}`, {
    method: metodo,
    // A Clicksign espera o token cru no Authorization, sem "Bearer".
    headers: { Authorization: token, 'Content-Type': JSONAPI, Accept: JSONAPI },
    body: JSON.stringify(corpo),
  });
  const texto = await resp.text();
  if (!resp.ok) {
    throw new Error(`Clicksign ${metodo} ${caminho} → ${resp.status}: ${texto.slice(0, 500)}`);
  }
  return texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
}

function idDaResposta(r: Record<string, unknown>): string {
  const data = r.data as { id?: unknown } | undefined;
  const id = String(data?.id ?? '');
  if (!id) throw new Error('Clicksign não devolveu o id do recurso criado');
  return id;
}

/** Base64 sem estourar a pilha em arquivos grandes (`apply` tem limite de args). */
function base64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  if (!Deno.env.get('CLICKSIGN_API_TOKEN') || !Deno.env.get('CLICKSIGN_API_BASE_URL')) {
    return json({ error: 'Clicksign não configurada no servidor' }, 500);
  }

  let body: { entregaId?: unknown; tipo?: unknown; storagePath?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'corpo inválido' }, 400);
  }
  const entregaId = String(body.entregaId ?? '').trim();
  const tipo = String(body.tipo ?? '').trim();
  const storagePath = String(body.storagePath ?? '').trim();
  if (!entregaId || !tipo || !storagePath) {
    return json({ error: 'entregaId, tipo e storagePath são obrigatórios' }, 400);
  }

  try {
    const { data: ent, error: entErr } = await admin
      .from('entregas')
      .select(
        `external_ref,
         unidades!inner ( identificacao ),
         clientes!inner ( nome, cpf, email )`,
      )
      .eq('external_ref', entregaId)
      .single();
    if (entErr || !ent) return json({ error: 'entrega não encontrada' }, 404);

    const cli = ent.clientes as unknown as { nome: string; cpf: string; email: string };
    const uni = ent.unidades as unknown as { identificacao: string };

    // Mesma checagem do cliente, refeita aqui: a validação da tela é UX, a do
    // servidor é a que vale.
    const cpfDigitos = cli.cpf.replace(/\D/g, '');
    if (cpfDigitos.length !== 11) {
      return json({ error: 'cliente sem CPF válido — cadastro incompleto no CRM' }, 422);
    }
    if (!cli.email.trim()) {
      return json({ error: 'cliente sem e-mail — cadastro incompleto no CRM' }, 422);
    }

    // Desvio de teste: enquanto a variável existir, nada sai para cliente real.
    const emailTeste = (Deno.env.get('CLICKSIGN_EMAIL_TESTE') ?? '').trim();
    const emailDestino = emailTeste || cli.email.trim();
    const modoTeste = emailTeste !== '';

    const { data: arquivo, error: dlErr } = await admin.storage
      .from('documentos')
      .download(storagePath);
    if (dlErr || !arquivo) {
      return json({ error: `PDF não encontrado no bucket: ${storagePath}` }, 404);
    }
    const pdfBase64 = base64(new Uint8Array(await arquivo.arrayBuffer()));

    // 1) Envelope
    const envelope = await clicksign('/envelopes', 'POST', {
      data: {
        type: 'envelopes',
        attributes: {
          name: `${tipo} — ${uni.identificacao}${modoTeste ? ' [TESTE]' : ''}`,
          locale: 'pt-BR',
          auto_close: true,
          default_subject: `${tipo} — Rottas Construtora`,
        },
      },
    });
    const envelopeId = idDaResposta(envelope);

    // 2) Documento
    const documento = await clicksign(`/envelopes/${envelopeId}/documents`, 'POST', {
      data: {
        type: 'documents',
        attributes: {
          filename: `${storagePath.split('/').pop() ?? 'termo.pdf'}`,
          content_base64: pdfBase64,
          metadata: JSON.stringify({ entregaId, tipo }),
        },
      },
    });
    const documentoId = idDaResposta(documento);

    // 3) Signatário
    const signer = await clicksign(`/envelopes/${envelopeId}/signers`, 'POST', {
      data: {
        type: 'signers',
        attributes: {
          name: cli.nome,
          email: emailDestino,
          has_documentation: true,
          documentation: cpfDigitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
          refusable: true,
          communicate_events: {
            signature_request: 'email',
            signature_reminder: 'email',
            document_signed: 'email',
          },
        },
      },
    });
    const signerId = idDaResposta(signer);

    // 4) Requisitos: qualificação (quem é) + autenticação (como comprova)
    const relacoes = {
      document: { data: { type: 'documents', id: documentoId } },
      signer: { data: { type: 'signers', id: signerId } },
    };
    await clicksign(`/envelopes/${envelopeId}/requirements`, 'POST', {
      data: {
        type: 'requirements',
        attributes: { action: 'agree', role: 'sign' },
        relationships: relacoes,
      },
    });
    await clicksign(`/envelopes/${envelopeId}/requirements`, 'POST', {
      data: {
        type: 'requirements',
        attributes: { action: 'provide_evidence', auth: 'email' },
        relationships: relacoes,
      },
    });

    // 5) Ativa — a partir daqui o convite sai por e-mail
    await clicksign(`/envelopes/${envelopeId}`, 'PATCH', {
      data: { type: 'envelopes', id: envelopeId, attributes: { status: 'running' } },
    });

    return json({ envelopeId, documentoId, signerId, modoTeste, emailDestino }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'falha ao enviar à Clicksign' }, 502);
  }
});
