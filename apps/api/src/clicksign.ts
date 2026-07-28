import { env } from './env.js';

/**
 * Cliente da API v3 da Clicksign.
 *
 * O token vive só aqui, no servidor. A URL base vem de env (allow-list): nada
 * de endpoint montado a partir de entrada do usuário.
 */

const JSONAPI = 'application/vnd.api+json';

/** Erro da Clicksign com o corpo preservado — sem isso sobra um status nu. */
export class ClicksignError extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    caminho: string,
  ) {
    super(`Clicksign ${caminho} → ${status}: ${corpo.slice(0, 500)}`);
    this.name = 'ClicksignError';
  }
}

async function chamar(
  caminho: string,
  metodo: 'GET' | 'POST' | 'PATCH',
  corpo?: unknown,
): Promise<Record<string, unknown>> {
  const base = (env.CLICKSIGN_API_BASE_URL ?? '').replace(/\/+$/, '');
  const resp = await fetch(`${base}/api/v3${caminho}`, {
    method: metodo,
    // A Clicksign espera o token cru no Authorization, sem "Bearer".
    headers: {
      Authorization: env.CLICKSIGN_API_TOKEN ?? '',
      'Content-Type': JSONAPI,
      Accept: JSONAPI,
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new ClicksignError(resp.status, texto, `${metodo} ${caminho}`);
  return texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
}

function idDaResposta(r: Record<string, unknown>): string {
  const id = String((r.data as { id?: unknown } | undefined)?.id ?? '');
  if (!id) throw new Error('Clicksign não devolveu o id do recurso criado');
  return id;
}

export interface EnvioConfissao {
  nomeEnvelope: string;
  nomeArquivo: string;
  pdf: Buffer;
  signatario: { nome: string; email: string; cpfFormatado: string };
  metadata: Record<string, string>;
}

export interface ResultadoEnvio {
  envelopeId: string;
  documentoId: string;
  signerId: string;
}

/**
 * Cria e ativa o envelope: envelope → documento → signatário → requisitos →
 * `running`. A partir do PATCH final o convite sai por e-mail, então ele é o
 * último passo de propósito: qualquer falha antes disso não notifica ninguém.
 */
export async function enviarParaAssinatura(dados: EnvioConfissao): Promise<ResultadoEnvio> {
  const envelope = await chamar('/envelopes', 'POST', {
    data: {
      type: 'envelopes',
      attributes: {
        name: dados.nomeEnvelope,
        locale: 'pt-BR',
        auto_close: true,
        default_subject: `${dados.nomeEnvelope} — Rottas Construtora`,
      },
    },
  });
  const envelopeId = idDaResposta(envelope);

  const documento = await chamar(`/envelopes/${envelopeId}/documents`, 'POST', {
    data: {
      type: 'documents',
      attributes: {
        filename: dados.nomeArquivo,
        content_base64: dados.pdf.toString('base64'),
        metadata: JSON.stringify(dados.metadata),
      },
    },
  });
  const documentoId = idDaResposta(documento);

  const signer = await chamar(`/envelopes/${envelopeId}/signers`, 'POST', {
    data: {
      type: 'signers',
      attributes: {
        name: dados.signatario.nome,
        email: dados.signatario.email,
        has_documentation: true,
        documentation: dados.signatario.cpfFormatado,
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

  // Dois requisitos por signatário: quem ele é (qualificação) e como comprova
  // (autenticação). Sem o de autenticação a Clicksign recusa a ativação.
  const relationships = {
    document: { data: { type: 'documents', id: documentoId } },
    signer: { data: { type: 'signers', id: signerId } },
  };
  await chamar(`/envelopes/${envelopeId}/requirements`, 'POST', {
    data: { type: 'requirements', attributes: { action: 'agree', role: 'sign' }, relationships },
  });
  await chamar(`/envelopes/${envelopeId}/requirements`, 'POST', {
    data: {
      type: 'requirements',
      attributes: { action: 'provide_evidence', auth: 'email' },
      relationships,
    },
  });

  await chamar(`/envelopes/${envelopeId}`, 'PATCH', {
    data: { type: 'envelopes', id: envelopeId, attributes: { status: 'running' } },
  });

  return { envelopeId, documentoId, signerId };
}
