/**
 * Validação de CPF (dígitos verificadores). Usado pelos mocks e, depois, pelos
 * schemas Zod de input. Não faz lookup externo — apenas a regra matemática.
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Valida um CPF (com ou sem máscara) pelos dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., etc.) — passam no cálculo mas são inválidas.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(cpf[i]!, 10) * (len + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calcDigit(9) === parseInt(cpf[9]!, 10) && calcDigit(10) === parseInt(cpf[10]!, 10);
}

/** Formata 11 dígitos como 000.000.000-00 (retorna o original se inválido). */
export function formatCpf(value: string): string {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return value;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
