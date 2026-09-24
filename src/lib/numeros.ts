import { fNum } from '@chaves/domain/format';

/** Inteiro pt-BR sem casas decimais. */
export const n0 = (v: number): string => fNum(v, 0);

/** % com 1 casa pt-BR (`12,2%`); base zero ou nula → "-". */
export const pct1 = (v: number, base: number): string =>
  base ? `${fNum((v / base) * 100, 1)}%` : '-';
