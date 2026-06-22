import { describe, expect, it } from 'vitest';
import { isValidCpf } from '@/lib/cpf';
import { createAdapters } from './index';
import { AdapterNotFoundError, AdapterNotImplementedError } from './errors';

describe('createAdapters', () => {
  it('mock resolve as quatro integrações', () => {
    const a = createAdapters('mock');
    expect(a.crm).toBeDefined();
    expect(a.erp).toBeDefined();
    expect(a.signature).toBeDefined();
    expect(a.notification).toBeDefined();
  });

  it('live é selecionável e ainda não conectado (lança NotImplemented)', async () => {
    const a = createAdapters('live');
    await expect(a.crm.getClienteByUnidade('uni-0001')).rejects.toBeInstanceOf(
      AdapterNotImplementedError,
    );
  });
});

describe('MockCrmAdapter', () => {
  const { crm } = createAdapters('mock');

  it('resolve cliente com CPF sintético VÁLIDO a partir da unidade', async () => {
    const cliente = await crm.getClienteByUnidade('uni-0001');
    expect(cliente.nome).toBeTruthy();
    expect(isValidCpf(cliente.cpf)).toBe(true);
  });

  it('lança NotFound para unidade sem cliente', async () => {
    await expect(crm.getClienteByUnidade('uni-inexistente')).rejects.toBeInstanceOf(
      AdapterNotFoundError,
    );
  });
});

describe('MockErpAdapter', () => {
  const { erp } = createAdapters('mock');

  it('retorna situação financeira da unidade', async () => {
    const sit = await erp.getSituacaoFinanceira('uni-0002');
    expect(sit.quitada).toBe(true);
    expect(sit.moeda).toBe('BRL');
  });
});

describe('MockClicksignAdapter', () => {
  const { signature } = createAdapters('mock');

  it('envia para assinatura e consulta status', async () => {
    const ref = await signature.enviarParaAssinatura({
      entregaId: 'ent-1',
      documentoId: 'doc-1',
      nomeArquivo: 'termo.pdf',
      mimeType: 'application/pdf',
      sha256Hash: 'a'.repeat(64),
      conteudoBase64: '',
      signatario: { nome: 'Fulano', email: 'f@x.com', cpf: '52998224725' },
    });
    expect(ref.provider).toBe('mock');
    expect(ref.documentKey).toContain('doc-1');

    const status = await signature.consultarStatus(ref);
    expect(status.state).toBe('signed');
    expect(status.signedAt).not.toBeNull();
  });
});
