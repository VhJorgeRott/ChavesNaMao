import type { Cliente } from './types.js';
import { isValidCpf } from './cpf.js';

/**
 * O que a Clicksign exige de um signatário antes de aceitar o envelope.
 *
 * Estes dados não são digitados em lugar nenhum do app: eles só existem se o CV
 * CRM tiver devolvido a pessoa. Quando a busca falha, `resolverCliente` cria um
 * cliente mínimo com CPF, e-mail e telefone vazios e o fluxo segue — o que é
 * inofensivo enquanto nada os usa, mas viraria um 422 cru na Clicksign, ou pior,
 * um termo enviado para a pessoa errada.
 *
 * Por isso a checagem mora aqui, antes do envio, e devolve o que falta em
 * português — para a tela poder dizer o que fazer em vez de mostrar um erro de
 * API.
 */

export interface PendenciaSignatario {
  /** Campos que faltam, prontos para exibição ("CPF", "e-mail"). */
  faltando: string[];
}

/**
 * Devolve `null` quando o cliente está apto a assinar, ou o que falta.
 *
 * O CPF é validado de fato (dígitos verificadores), não só quanto à presença: um
 * CPF inválido é recusado pela Clicksign do mesmo jeito, e é melhor descobrir
 * isso aqui do que depois de montar meio envelope.
 */
export function verificarSignatario(cliente: Cliente | undefined): PendenciaSignatario | null {
  if (!cliente) return { faltando: ['cadastro do cliente'] };

  const faltando: string[] = [];
  if (!cliente.nome.trim() || cliente.nome.trim().split(/\s+/).length < 2) {
    // A Clicksign exige nome completo (mínimo duas palavras).
    faltando.push('nome completo');
  }
  if (!isValidCpf(cliente.cpf)) faltando.push('CPF');
  // A autenticação escolhida é por e-mail: sem ele não há para onde enviar.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email.trim())) faltando.push('e-mail');

  return faltando.length > 0 ? { faltando } : null;
}

/** Frase pronta para o aviso na tela: "CPF e e-mail". */
export function listarPendencias(p: PendenciaSignatario): string {
  const [ultimo, ...resto] = [...p.faltando].reverse();
  return resto.length === 0 ? (ultimo ?? '') : `${resto.reverse().join(', ')} e ${ultimo}`;
}
