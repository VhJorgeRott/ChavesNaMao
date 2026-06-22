import type {
  DocumentoParaAssinar,
  SignatureAdapter,
  SignatureRef,
  SignatureStatus,
} from '../types';

/**
 * Clicksign (mock): simula o envio para assinatura e a consulta de status sem
 * chamar a API. Útil no MVP e nos testes. Não persiste nada sensível.
 */
export class MockClicksignAdapter implements SignatureAdapter {
  async enviarParaAssinatura(doc: DocumentoParaAssinar): Promise<SignatureRef> {
    const documentKey = `mock-${doc.documentoId}-${Date.now().toString(36)}`;
    return {
      provider: 'mock',
      documentKey,
      signUrl: `https://mock.clicksign.local/sign/${documentKey}`,
    };
  }

  async consultarStatus(_ref: SignatureRef): Promise<SignatureStatus> {
    // No mock, consideramos a assinatura concluída imediatamente.
    return {
      state: 'signed',
      signedAt: new Date().toISOString(),
      providerStatus: 'signed',
    };
  }
}
