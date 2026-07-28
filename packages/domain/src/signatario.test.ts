import { describe, expect, it } from 'vitest';
import { listarPendencias, verificarSignatario } from './signatario.js';
import type { Cliente } from './types.js';

const COMPLETO: Cliente = {
  id: 'cli-1',
  nome: 'Maria Aparecida Souza',
  cpf: '529.982.247-25', // CPF válido (dígitos verificadores corretos)
  email: 'maria@exemplo.com.br',
  telefone: '41999990000',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('verificação do signatário para a Clicksign', () => {
  it('aprova cliente com nome completo, CPF válido e e-mail', () => {
    expect(verificarSignatario(COMPLETO)).toBeNull();
  });

  it('barra o cliente mínimo criado quando o CRM não acha a pessoa', () => {
    // É exatamente o fallback de `resolverCliente`: nome do ERP e o resto vazio.
    const p = verificarSignatario({ ...COMPLETO, nome: 'Cliente', cpf: '', email: '' });
    expect(p?.faltando).toEqual(['nome completo', 'CPF', 'e-mail']);
  });

  it('recusa CPF com dígito verificador errado, não só ausente', () => {
    expect(verificarSignatario({ ...COMPLETO, cpf: '111.111.111-11' })?.faltando).toEqual(['CPF']);
  });

  it('exige nome com pelo menos duas palavras', () => {
    expect(verificarSignatario({ ...COMPLETO, nome: 'Maria' })?.faltando).toEqual([
      'nome completo',
    ]);
  });

  it('recusa e-mail malformado', () => {
    expect(verificarSignatario({ ...COMPLETO, email: 'maria@' })?.faltando).toEqual(['e-mail']);
  });

  it('trata cliente inexistente', () => {
    expect(verificarSignatario(undefined)?.faltando).toEqual(['cadastro do cliente']);
  });

  it('monta a frase do aviso em português', () => {
    expect(listarPendencias({ faltando: ['CPF'] })).toBe('CPF');
    expect(listarPendencias({ faltando: ['CPF', 'e-mail'] })).toBe('CPF e e-mail');
    expect(listarPendencias({ faltando: ['nome completo', 'CPF', 'e-mail'] })).toBe(
      'nome completo, CPF e e-mail',
    );
  });
});
