import type { Unidade } from '@chaves/domain/types';
import type { UnidadeErp } from '@/adapters/types';

/**
 * Catálogo completo de unidades de um empreendimento. O mapa de disponibilidade
 * do CV é a base: traz todas as unidades cadastradas — disponíveis,
 * bloqueadas, reservadas e vendidas —, esteja o empreendimento no Mega ou não.
 *
 * O status comercial segue a carteira do Mega: VENDIDA é quem tem contrato
 * lá; todo o resto é DISPONIVEL, qualquer que seja a situação no CV
 * (bloqueada, reservada...) — a situação do CV continua na ficha, em
 * `situacaoCv`. O Mega também acrescenta cliente, contrato e inadimplência. Unidades casadas mantêm o id do Mega (é a chave das entregas
 * já gravadas) e ganham `cvUnidadeId` para cruzar com o resto do CV. O
 * cruzamento é por bloco + número da unidade, porque os ids e a grafia das
 * identificações diferem entre os dois sistemas:
 *
 *   Mega: "BLOCO D · 608"        CV: "Etapa Única · BLOCO D · TORRE D - 608"
 */

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/** Segmentos "etapa · bloco · unidade" da identificação. */
function segmentos(identificacao: string): string[] {
  return identificacao
    .split('·')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Número da unidade: último token com dígito, sem prefixo de letras nem zeros
 * à esquerda. "TORRE D - 608" → "608", "1 (PNE)" → "1", "UN15" → "15",
 * "0012A" → "12A".
 */
export function numeroUnidade(nome: string): string {
  const tokens = normalizar(nome).match(/[A-Z0-9]+/g) ?? [];
  const comDigito = [...tokens].reverse().find((t) => /\d/.test(t));
  if (!comDigito) return tokens.join('');
  return comDigito.replace(/^[A-Z]+/, '').replace(/^0+(?=\d)/, '');
}

/** Bloco compacto, sem zeros à esquerda nos números: "Bloco 01" → "BLOCO1". */
function chaveBloco(bloco: string): string {
  return normalizar(bloco)
    .replace(/[^A-Z0-9]/g, '')
    .replace(/(^|[A-Z])0+(?=\d)/g, '$1');
}

interface Chaves {
  completa: string;
  numero: string;
}

function chaves(u: Unidade): Chaves {
  const segs = segmentos(u.identificacao);
  const numero = numeroUnidade(segs[segs.length - 1] ?? '');
  const bloco = segs.length >= 2 ? chaveBloco(segs[segs.length - 2]!) : '';
  return { completa: `${bloco}|${numero}`, numero };
}

function contar(valores: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

/**
 * Parcela mínima de unidades do Mega que precisam casar com o CV para
 * confiarmos que uma unidade VENDIDA do CV sem par é mesmo "sem contrato" (e
 * não só uma grafia que o cruzamento não reconheceu — o que a duplicaria).
 */
const CONFIANCA_MINIMA = 0.9;

export function mesclarCatalogo(doErp: UnidadeErp[], doCrm: Unidade[]): Unidade[] {
  const chavesCrm = doCrm.map(chaves);
  const porCompleta = new Map<string, number>();
  chavesCrm.forEach((c, i) => {
    if (!porCompleta.has(c.completa)) porCompleta.set(c.completa, i);
  });
  // Fallback só pelo número quando ele é único dos DOIS lados — cobre blocos
  // grafados de forma diferente sem arriscar casar o 101 do bloco A com o do B.
  const numerosCrm = contar(chavesCrm.map((c) => c.numero));
  const numerosErp = contar(doErp.map((u) => chaves(u).numero));
  const porNumero = new Map<string, number>();
  chavesCrm.forEach((c, i) => {
    if (numerosCrm.get(c.numero) === 1) porNumero.set(c.numero, i);
  });
  const idsCrm = new Map(doCrm.map((u, i) => [u.id, i] as const));

  const usadas = new Set<number>();
  const enriquecidas: Unidade[] = doErp.map((u) => {
    const c = chaves(u);
    let i = idsCrm.get(u.id) ?? porCompleta.get(c.completa);
    if (i === undefined && numerosErp.get(c.numero) === 1) i = porNumero.get(c.numero);
    if (i === undefined || usadas.has(i)) return u;
    usadas.add(i);
    const doCv = doCrm[i]!;
    return {
      ...u,
      areaM2: u.areaM2 ?? (doCv.areaM2 != null && doCv.areaM2 > 0 ? doCv.areaM2 : null),
      cvUnidadeId: doCv.cvUnidadeId ?? doCv.id,
      situacaoCv: doCv.situacaoCv ?? null,
      motivoBloqueioCv: doCv.motivoBloqueioCv ?? null,
    };
  });

  const confiavel = doErp.length === 0 || usadas.size / doErp.length >= CONFIANCA_MINIMA;
  // Sem par no Mega = sem contrato na carteira = disponível. Se o cruzamento
  // não foi confiável, as "vendidas" do CV sem par provavelmente são unidades
  // do Mega com grafia diferente: ficam de fora para não aparecerem em dobro.
  const soNoCv = doCrm
    .filter((u, i) => !usadas.has(i) && (confiavel || u.status !== 'VENDIDA'))
    .map((u) => ({ ...u, status: 'DISPONIVEL' as const, cvUnidadeId: u.cvUnidadeId ?? u.id }));
  return [...enriquecidas, ...soNoCv];
}
