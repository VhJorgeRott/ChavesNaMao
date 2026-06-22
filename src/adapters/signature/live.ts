import type {
  DocumentoParaAssinar,
  SignatureAdapter,
  SignatureRef,
  SignatureStatus,
} from '../types';
import { AdapterNotImplementedError } from '../errors';

/**
 * Clicksign (live). Camada de validade jurídica (MP 2.200-2).
 *
 * Roda no SERVIDOR (Edge Function): CLICKSIGN_API_TOKEN como secret, TLS
 * obrigatório, endpoint allow-listed. A confirmação assíncrona da assinatura
 * chega por WEBHOOK, cujo payload deve ser validado por HMAC
 * (CLICKSIGN_WEBHOOK_HMAC_SECRET) e processado de forma idempotente (8.7).
 */
export class LiveClicksignAdapter implements SignatureAdapter {
  async enviarParaAssinatura(_doc: DocumentoParaAssinar): Promise<SignatureRef> {
    // TODO(live): upload do PDF + criação do signatário/lista na Clicksign.
    throw new AdapterNotImplementedError('LiveClicksignAdapter');
  }

  async consultarStatus(_ref: SignatureRef): Promise<SignatureStatus> {
    // TODO(live): consultar status pelo documentKey (fonte da verdade é o webhook).
    throw new AdapterNotImplementedError('LiveClicksignAdapter');
  }
}
