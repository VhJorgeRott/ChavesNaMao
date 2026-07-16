import { describe, expect, it } from 'vitest';
import { MockPortalAdapter } from './mock';
import type { PortalSnapshot } from '../types';

const snapshot = (entregaId = 'ent-1'): PortalSnapshot => ({
  entrega: { externalRef: entregaId },
  empreendimento: { externalRef: 'emp-1', nome: 'Cond. Teste', cidade: 'Curitiba', uf: 'PR' },
  unidade: { externalRef: 'uni-1', identificacao: 'Apto 101', areaM2: 60, status: 'LIBERADA' },
  cliente: {
    externalRef: 'cli-1',
    nome: 'Fulano de Tal',
    cpf: '12345678909',
    email: 'fulano@example.com',
    telefone: '41999998888',
  },
});

describe('MockPortalAdapter', () => {
  it('gera link e resolve o token com o snapshot de exibição', async () => {
    const portal = new MockPortalAdapter();
    const { token, url } = await portal.gerarLink(snapshot());
    expect(token).toBeTruthy();
    expect(url).toContain(`/portal/${encodeURIComponent(token)}`);

    const r = await portal.resolver(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.delivery.entregaId).toBe('ent-1');
      expect(r.delivery.cliente.nome).toBe('Fulano de Tal');
      expect(r.delivery.unidade.identificacao).toBe('Apto 101');
      expect(r.delivery.empreendimento.nome).toBe('Cond. Teste');
    }
  });

  it('token desconhecido é inválido', async () => {
    const portal = new MockPortalAdapter();
    expect(await portal.resolver('nao-existe')).toEqual({ ok: false });
  });

  it('uso único: após assinar, o token não resolve nem assina de novo', async () => {
    const portal = new MockPortalAdapter();
    const { token } = await portal.gerarLink(snapshot('ent-2'));

    const ass = await portal.registrarAssinatura({
      token,
      pngDataUrl: 'data:image/png;base64,AAAA',
      geo: null,
      userAgent: 'test',
    });
    expect(ass).toEqual({ ok: true, entregaId: 'ent-2' });

    expect(await portal.resolver(token)).toEqual({ ok: false });
    expect(
      await portal.registrarAssinatura({ token, pngDataUrl: 'x', geo: null, userAgent: 't' }),
    ).toEqual({ ok: false });
  });

  it('gerar um novo link invalida o token anterior da mesma entrega', async () => {
    const portal = new MockPortalAdapter();
    const primeiro = await portal.gerarLink(snapshot('ent-3'));
    const segundo = await portal.gerarLink(snapshot('ent-3'));

    expect(await portal.resolver(primeiro.token)).toEqual({ ok: false });
    expect((await portal.resolver(segundo.token)).ok).toBe(true);
  });
});
