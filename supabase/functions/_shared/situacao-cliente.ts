// Situação do cliente no CV — atendimentos de relacionamento e sinalizador
// jurídico. Tipos e regras puras (sem Deno/DOM), compartilhados entre a Edge
// Function `crm-situacao-cliente` e o app. Mantenha-o sem imports.
//
// Fontes (descobertas em 2026-09-22 testando a API real):
//  - GET /api/v1/relacionamento/atendimentos/listar?documento=CPF — todos os
//    atendimentos da pessoa. A rota sem `/listar` devolve só os 500 mais
//    recentes e ignora filtros e paginação, por isso não serve.
//  - GET /api/v1/cadastros/clientes?documento=CPF — cadastro da pessoa, com o
//    campo `sinalizador_juridico` (a API só documenta o PUT que o altera).

export interface AtendimentoRelacionamento {
  id: string;
  protocolo: string | null;
  titulo: string;
  assunto: string | null;
  subassunto: string | null;
  situacao: string;
  /** Data/hora de abertura (ISO sem fuso, hora local). */
  abertoEm: string | null;
  finalizadoEm: string | null;
  canceladoEm: string | null;
  /** Sem finalização nem cancelamento. */
  aberto: boolean;
  responsavel: string | null;
  /** Id da unidade no CV (mesmo id do mapa de disponibilidade). */
  unidadeId: string | null;
  unidade: string | null;
  bloco: string | null;
  empreendimentoId: string | null;
}

export interface SituacaoClienteCv {
  atendimentos: AtendimentoRelacionamento[];
  juridico: {
    /** `null` quando a pessoa não foi encontrada no cadastro do CV. */
    ativo: boolean | null;
    /** Valor cru do CV, para diagnóstico enquanto o formato não é conhecido. */
    valor: string | null;
  };
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function mapearAtendimento(a: Record<string, unknown>): AtendimentoRelacionamento {
  const emp = (a.empreendimento ?? null) as { idempreendimento?: unknown } | null;
  const finalizadoEm = texto(a.dataFinalizacao);
  const canceladoEm = texto(a.dataCancelamento);
  return {
    id: String(a.idatendimento ?? ''),
    protocolo: texto(a.protocolo),
    titulo: texto(a.titulo) ?? texto(a.assunto) ?? 'Atendimento',
    assunto: texto(a.assunto),
    subassunto: texto(a.subassunto),
    situacao: texto(a.situacao) ?? '—',
    abertoEm: texto(a.dataCad),
    finalizadoEm,
    canceladoEm,
    aberto: !finalizadoEm && !canceladoEm,
    responsavel: texto(a.responsavel),
    unidadeId: texto(a.idsUnidades),
    unidade: texto(a.unidades),
    bloco: texto(a.bloco),
    empreendimentoId: texto(emp?.idempreendimento),
  };
}

/**
 * Lê o `sinalizador_juridico` do cadastro. O formato do valor "ligado" ainda
 * não foi visto na base (só `null`), então aceitamos as formas usuais do CV —
 * "S", "1", true, "Ativo", ou um objeto com `ativo`/`situacao`.
 */
export function interpretarSinalizador(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return interpretarSinalizador(o.ativo ?? o.situacao ?? o.status ?? null);
  }
  const s = String(v)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return ['s', 'sim', '1', 'true', 'ativo', 'a', 'y', 'yes'].includes(s);
}
