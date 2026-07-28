/**
 * Formatação BR centralizada. Reutilize estes helpers em todo o app — não crie
 * `formatCurrency`/`formatBRL` locais (regra do design system).
 */

const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda0 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function isNil(v: number | null | undefined): boolean {
  return v === null || v === undefined || Number.isNaN(v);
}

/** `R$ 1.234` (0 decimais). Trata null/NaN como "-". */
export function fMoeda(value: number | null | undefined): string {
  if (isNil(value)) return '-';
  return moeda0.format(value as number);
}

/** `1.234,50` (2 decimais por padrão). Trata null/NaN como "-". */
export function fNum(value: number | null | undefined, dec = 2): string {
  if (isNil(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(value as number);
}

/** `47,1%` (espera fração 0..1). */
export function formatPct(value: number | null | undefined): string {
  if (isNil(value)) return '-';
  return `${nf2.format((value as number) * 100).replace(',00', '')}%`;
}

/** Data curta `22/06/2026`. Aceita ISO string ou Date; null → "-". */
export function fData(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

/** Data e hora `22/06/2026 14:30`. */
export function fDataHora(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Área em m²: `250 m²`. */
export function fArea(value: number | null | undefined): string {
  if (isNil(value)) return '-';
  return `${fNum(value, value && value % 1 !== 0 ? 2 : 0)} m²`;
}

/** CPF mascarado parcialmente para exibição (LGPD): `***.982.247-**`. */
export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
