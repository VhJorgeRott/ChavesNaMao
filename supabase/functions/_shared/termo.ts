// Resolução das variáveis `{{grupo.campo}}` dos modelos de termo — lado servidor.
//
// Espelha src/domain/termo.ts. A duplicação é deliberada e o motivo é chato mas
// real: uma Edge Function (Deno) não importa de `src/` (Vite/alias `@/`, e o
// bundle do browser carrega coisas que não existem no Deno). Como o texto do
// termo é o que o cliente assina, a resolução PRECISA acontecer no servidor —
// deixar o navegador mandar o texto pronto significaria assinar o que o cliente
// do usuário quisesse.
//
// Ao mexer nas variáveis, mexa nos DOIS arquivos. O teste
// `src/domain/termo.paridade.test.ts` falha se as chaves divergirem.

export interface ContextoTermo {
  cliente?: { nome: string; cpf: string; email: string; telefone: string };
  unidade?: { identificacao: string; areaM2: number | null };
  empreendimento?: { nome: string; cidade: string; uf: string };
  financeiro?: {
    numeroContrato: string;
    valorContrato: number;
    saldoDevedor: number;
    parcelasEmAberto: number;
  };
  /** Campos sem fonte automática (dados do credor, testemunhas, imóvel). */
  extras?: Record<string, string>;
}

function fMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fArea(m2: number | null): string {
  return m2 == null ? '' : `${m2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf;
}

function hoje(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const extra =
  (chave: string) =>
  (c: ContextoTermo): string =>
    c.extras?.[chave] ?? '';

export const RESOLVERS: Record<string, (c: ContextoTermo) => string> = {
  'cliente.nome': (c) => c.cliente?.nome ?? '',
  'cliente.cpf': (c) => (c.cliente ? formatCpf(c.cliente.cpf) : ''),
  'cliente.email': (c) => c.cliente?.email ?? '',
  'cliente.telefone': (c) => c.cliente?.telefone ?? '',
  'unidade.identificacao': (c) => c.unidade?.identificacao ?? '',
  'unidade.area': (c) => (c.unidade ? fArea(c.unidade.areaM2) : ''),
  'empreendimento.nome': (c) => c.empreendimento?.nome ?? '',
  'empreendimento.cidade': (c) => c.empreendimento?.cidade ?? '',
  'empreendimento.uf': (c) => c.empreendimento?.uf ?? '',
  'financeiro.contrato': (c) => c.financeiro?.numeroContrato ?? '',
  'financeiro.valorContrato': (c) => (c.financeiro ? fMoeda(c.financeiro.valorContrato) : ''),
  'financeiro.saldoDevedor': (c) => (c.financeiro ? fMoeda(c.financeiro.saldoDevedor) : ''),
  'financeiro.parcelasEmAberto': (c) =>
    c.financeiro ? String(c.financeiro.parcelasEmAberto) : '',
  'data.hoje': () => hoje(),
  'credor.razaoSocial': (c) =>
    c.extras?.['credor.razaoSocial'] || 'Rottas Construtora e Incorporadora Ltda.',
  'credor.cnpj': extra('credor.cnpj'),
  'credor.endereco': extra('credor.endereco'),
  'cliente.rg': extra('cliente.rg'),
  'cliente.nacionalidade': extra('cliente.nacionalidade'),
  'cliente.estadoCivil': extra('cliente.estadoCivil'),
  'cliente.profissao': extra('cliente.profissao'),
  'cliente.endereco': extra('cliente.endereco'),
  'imovel.matricula': extra('imovel.matricula'),
  'imovel.cartorio': extra('imovel.cartorio'),
  'imovel.quadra': extra('imovel.quadra'),
  'imovel.lote': extra('imovel.lote'),
  'divida.valorTotal': extra('divida.valorTotal'),
  'divida.valorTotalExtenso': extra('divida.valorTotalExtenso'),
  'divida.valorEntrada': extra('divida.valorEntrada'),
  'divida.numeroParcelas': extra('divida.numeroParcelas'),
  'divida.valorParcela': extra('divida.valorParcela'),
  'divida.valorParcelaExtenso': extra('divida.valorParcelaExtenso'),
  'divida.vencimentoPrimeira': extra('divida.vencimentoPrimeira'),
  'divida.indiceCorrecao': extra('divida.indiceCorrecao'),
  'divida.jurosMora': extra('divida.jurosMora'),
  'divida.multaAtraso': extra('divida.multaAtraso'),
  'divida.formaPagamento': extra('divida.formaPagamento'),
  'geral.foro': extra('geral.foro'),
  'geral.testemunha1': extra('geral.testemunha1'),
  'geral.testemunha2': extra('geral.testemunha2'),
};

const VAR_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Resolve as variáveis do modelo. Desconhecidas ficam como estão (flagra typo). */
export function renderTermo(conteudo: string, ctx: ContextoTermo): string {
  return conteudo.replace(VAR_REGEX, (match, chave: string) => {
    const resolver = RESOLVERS[chave];
    return resolver ? resolver(ctx) : match;
  });
}

/**
 * Variáveis do modelo que ficariam VAZIAS com este contexto.
 *
 * É o que permite recusar o envio de um termo de confissão sem o valor da
 * dívida — um documento com validade jurídica e a cláusula principal em branco
 * é pior do que documento nenhum.
 */
export function variaveisVazias(conteudo: string, ctx: ContextoTermo): string[] {
  const vazias = new Set<string>();
  for (const m of conteudo.matchAll(VAR_REGEX)) {
    const chave = m[1]!;
    const resolver = RESOLVERS[chave];
    if (resolver && resolver(ctx).trim() === '') vazias.add(chave);
  }
  return [...vazias];
}
