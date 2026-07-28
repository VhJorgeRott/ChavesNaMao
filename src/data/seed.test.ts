import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * O catálogo de demonstração não pode existir quando há integração real ligada.
 *
 * Já aconteceu em produção: "Residencial Jardim das Acácias" e "Loteamento
 * Terras do Lago" apareceram na tela de Unidades ao lado dos empreendimentos do
 * CV, e entraram na contagem do dashboard. O seed é conveniente em mock e é
 * dado falso em live — este teste guarda essa fronteira.
 */

async function estadoCom(envMock: Record<string, string>) {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    env: {
      VITE_ADAPTER_MODE: 'mock',
      VITE_PUBLIC_APP_URL: 'http://localhost:5173',
      ...envMock,
    },
  }));
  const { createInitialState } = await import('./seed');
  return createInitialState();
}

describe('estado inicial x modo dos adapters', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock('@/lib/env'));

  it('em mock traz o catálogo de demonstração', async () => {
    const s = await estadoCom({ VITE_ADAPTER_MODE: 'mock' });
    expect(s.empreendimentos.length).toBeGreaterThan(0);
    expect(s.unidades.length).toBeGreaterThan(0);
    expect(s.entregas.length).toBeGreaterThan(0);
  });

  it('com o modo global em live não traz nenhum dado de demonstração', async () => {
    const s = await estadoCom({ VITE_ADAPTER_MODE: 'live' });
    expect(s.empreendimentos).toEqual([]);
    expect(s.unidades).toEqual([]);
    expect(s.entregas).toEqual([]);
    expect(s.clientes).toEqual([]);
    expect(s.documentos).toEqual([]);
    expect(s.assinaturas).toEqual([]);
  });

  it('basta UMA integração em live para não semear', async () => {
    // É o caso real do projeto: global em mock, CRM e ERP em live.
    const s = await estadoCom({ VITE_ADAPTER_MODE: 'mock', VITE_CRM_MODE: 'live' });
    expect(s.empreendimentos).toEqual([]);
    expect(s.unidades).toEqual([]);
  });

  it('mantém usuários mesmo em live (seletor de usuário e resolução de responsável)', async () => {
    const s = await estadoCom({ VITE_ADAPTER_MODE: 'live' });
    expect(s.usuarios.length).toBeGreaterThan(0);
  });
});
