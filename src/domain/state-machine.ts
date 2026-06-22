import { ENTREGA_STATUS, type EntregaStatus } from './types';

/**
 * Máquina de estados da entrega (6 etapas, lineares).
 *
 *   ABERTURA → INTEGRACAO → DOCUMENTOS → ASSINATURA → REGISTRO → CONCLUIDA
 *
 * "Insecure Design" do OWASP: não se pode pular etapas. As transições válidas
 * são definidas aqui e DEVEM ser revalidadas no servidor (Edge Function) — esta
 * lógica de cliente é apenas UX. A verdade está sempre no servidor.
 */

/** Mapa de cada estado para os estados imediatamente alcançáveis. */
const TRANSICOES: Record<EntregaStatus, readonly EntregaStatus[]> = {
  ABERTURA: ['INTEGRACAO'],
  INTEGRACAO: ['DOCUMENTOS'],
  DOCUMENTOS: ['ASSINATURA'],
  ASSINATURA: ['REGISTRO'],
  REGISTRO: ['CONCLUIDA'],
  CONCLUIDA: [],
};

export const ESTADO_INICIAL: EntregaStatus = 'ABERTURA';
export const ESTADO_FINAL: EntregaStatus = 'CONCLUIDA';

/** Erro lançado quando uma transição inválida é tentada. */
export class TransicaoInvalidaError extends Error {
  constructor(
    readonly de: EntregaStatus,
    readonly para: EntregaStatus,
  ) {
    super(`Transição inválida: ${de} → ${para}`);
    this.name = 'TransicaoInvalidaError';
  }
}

/** Próximos estados válidos a partir de `atual` (vazio se terminal). */
export function proximosEstados(atual: EntregaStatus): readonly EntregaStatus[] {
  return TRANSICOES[atual];
}

/** Retorna true se `atual → proximo` é uma transição permitida. */
export function podeTransicionar(atual: EntregaStatus, proximo: EntregaStatus): boolean {
  return TRANSICOES[atual].includes(proximo);
}

/** É um estado terminal (sem transições de saída)? */
export function isTerminal(estado: EntregaStatus): boolean {
  return TRANSICOES[estado].length === 0;
}

/**
 * Aplica a transição, retornando o novo estado.
 * Lança `TransicaoInvalidaError` se a transição não for permitida (deny-by-default).
 */
export function transicionar(atual: EntregaStatus, proximo: EntregaStatus): EntregaStatus {
  if (!podeTransicionar(atual, proximo)) {
    throw new TransicaoInvalidaError(atual, proximo);
  }
  return proximo;
}

/** Índice 0-based da etapa (útil para renderizar a timeline). */
export function indiceEtapa(estado: EntregaStatus): number {
  return ENTREGA_STATUS.indexOf(estado);
}
