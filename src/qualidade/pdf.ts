import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  type InspecaoFvs,
  RESULTADO_ITEM_LABEL,
  descreverLocal,
  hierarquiaLocal,
  itensDaInspecao,
  progressoInspecao,
} from '@chaves/domain/qualidade';

/**
 * "Registro de Inspeção de Serviço" em PDF, no mesmo formato do relatório que a
 * equipe emitia no Mobuss: informações gerais, dados da inspeção, locais
 * avaliados, responsável e a tabela de itens.
 *
 * Gerado NO APARELHO (pdf-lib), e não no servidor: a ficha precisa virar PDF
 * mesmo em obra sem sinal, logo depois de concluída.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 40;
const LARGURA = A4[0] - MARGEM * 2;
const CINZA = rgb(0.45, 0.45, 0.45);
const PRETO = rgb(0.1, 0.1, 0.12);
const LINHA = rgb(0.85, 0.85, 0.85);
const FUNDO = rgb(0.96, 0.96, 0.96);
const VERMELHO = rgb(0.75, 0.15, 0.15);

/** pdf-lib usa WinAnsi nas fontes padrão: troca o que estiver fora dela. */
function sanear(texto: string): string {
  return (
    texto
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00a0/g, ' ')
      // Fora do WinAnsi (emoji, sinais raros) vira "?" em vez de quebrar o PDF.
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\xff]/g, '?')
  );
}

function fDataBr(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function fDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Quebra o texto em linhas que cabem na largura. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of sanear(texto).split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas.length > 0 ? linhas : [''];
}

export interface DadosPdfInspecao {
  inspecao: InspecaoFvs;
  /** Quem emitiu o PDF (aparece no rodapé, como no Mobuss). */
  emitidoPor: string;
  /** Fotos disponíveis no aparelho, por id (jpeg/png). Entram no anexo. */
  fotos?: Map<string, { bytes: Uint8Array; tipo: string }>;
}

export async function gerarPdfInspecao({
  inspecao,
  emitidoPor,
  fotos,
}: DadosPdfInspecao): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const geradoEm = fDataHoraBr(new Date().toISOString());

  let pagina: PDFPage = doc.addPage(A4);
  let y = 0;

  const cabecalho = (): void => {
    y = A4[1] - MARGEM;
    pagina.drawText('REGISTRO DE INSPEÇÃO DE SERVIÇO', {
      x: MARGEM,
      y,
      size: 13,
      font: negrito,
      color: PRETO,
    });
    y -= 14;
    pagina.drawText('Formulário de Ficha de Verificação de Serviço', {
      x: MARGEM,
      y,
      size: 9,
      font: normal,
      color: CINZA,
    });
    y -= 10;
    pagina.drawLine({
      start: { x: MARGEM, y },
      end: { x: MARGEM + LARGURA, y },
      thickness: 0.7,
      color: LINHA,
    });
    y -= 18;
  };

  const novaPagina = (): void => {
    pagina = doc.addPage(A4);
    cabecalho();
  };

  /** Garante espaço; abre página nova quando não cabe. */
  const espaco = (altura: number): void => {
    if (y - altura < MARGEM + 28) novaPagina();
  };

  const titulo = (texto: string): void => {
    espaco(26);
    pagina.drawText(sanear(texto), { x: MARGEM, y, size: 10, font: negrito, color: PRETO });
    y -= 6;
    pagina.drawLine({
      start: { x: MARGEM, y },
      end: { x: MARGEM + LARGURA, y },
      thickness: 0.5,
      color: LINHA,
    });
    y -= 14;
  };

  /** Linha "rótulo .... valor", como no relatório do Mobuss. */
  const campo = (rotulo: string, valor: string, destaque = false): void => {
    const linhas = quebrar(valor || '-', normal, 9, LARGURA - 170);
    espaco(linhas.length * 12 + 2);
    pagina.drawText(sanear(rotulo), { x: MARGEM, y, size: 9, font: normal, color: CINZA });
    linhas.forEach((linha, i) => {
      pagina.drawText(linha, {
        x: MARGEM + 165,
        y: y - i * 11,
        size: 9,
        font: destaque ? negrito : normal,
        color: PRETO,
      });
    });
    y -= linhas.length * 11 + 3;
  };

  cabecalho();

  const progresso = progressoInspecao(inspecao);
  const conformidade = progresso.conformidade === null ? '-' : `${progresso.conformidade} %`;

  titulo('Informações Gerais');
  campo('Obra', inspecao.local.empreendimentoNome);
  campo('Data de Realização', fDataBr(inspecao.concluidaEm ?? inspecao.iniciadaEm));
  campo('Usuário de Criação', inspecao.inspetorNome);
  campo('Conformidade', conformidade, true);
  campo('Data de Criação', fDataHoraBr(inspecao.iniciadaEm));
  campo('Data de Conclusão', fDataHoraBr(inspecao.concluidaEm));
  y -= 6;

  const nomeFicha = [inspecao.modeloCodigo, inspecao.modeloNome].filter(Boolean).join(' - ');
  titulo(`Inspeção: ${nomeFicha}${inspecao.reinspecaoDe ? ' (reinspeção)' : ''}`);
  campo('Descrição', nomeFicha);
  campo('Categoria', 'Inspeção');
  campo('Tipo', 'Ficha de Verificação de Serviço');
  campo('Revisão', `Rev${String(inspecao.modeloVersao).padStart(2, '0')}`);
  campo('Identificador', inspecao.identificador ?? '-');
  campo('Validade', fDataBr(inspecao.validade));
  campo('Data do Atendimento', fDataBr(inspecao.dataAtendimento));
  campo('Fornecedor', inspecao.fornecedor ?? '-');
  campo('Responsável', inspecao.responsavel ?? '-');
  y -= 6;

  titulo('Locais avaliados');
  campo('Código', inspecao.local.codigo ?? '-');
  campo('Nome', descreverLocal(inspecao.local));
  campo('Hierarquia', hierarquiaLocal(inspecao.local));
  y -= 10;

  // --- Itens do formulário -------------------------------------------------
  const COL_DESCRICAO = LARGURA - 190;
  const X_DATA = MARGEM + COL_DESCRICAO + 10;
  const X_RESPOSTA = X_DATA + 70;

  const cabecalhoItens = (): void => {
    espaco(24);
    pagina.drawText('Descrição', { x: MARGEM, y, size: 8, font: negrito, color: CINZA });
    pagina.drawText('Data', { x: X_DATA, y, size: 8, font: negrito, color: CINZA });
    pagina.drawText('Resposta', { x: X_RESPOSTA, y, size: 8, font: negrito, color: CINZA });
    y -= 4;
    pagina.drawLine({
      start: { x: MARGEM, y },
      end: { x: MARGEM + LARGURA, y },
      thickness: 0.5,
      color: LINHA,
    });
    y -= 12;
  };

  titulo('Itens do Formulário');
  cabecalhoItens();

  itensDaInspecao(inspecao).forEach(({ item }, indice) => {
    const resposta = inspecao.respostas[item.id];
    const detalhes = [
      item.criterio ? `Critério: ${item.criterio}` : null,
      item.metodo ? `Método de verificação: ${item.metodo}` : null,
      resposta?.observacao ? `Observação: ${resposta.observacao}` : null,
    ].filter((t): t is string => t !== null);

    const linhasTexto = quebrar(`${indice + 1} - ${item.texto}`, normal, 9, COL_DESCRICAO);
    const linhasDetalhe = detalhes.flatMap((d) => quebrar(d, normal, 7.5, COL_DESCRICAO));
    const altura = linhasTexto.length * 11 + linhasDetalhe.length * 9 + 8;
    espaco(altura);

    const topo = y + 9;
    linhasTexto.forEach((linha, i) => {
      pagina.drawText(linha, { x: MARGEM, y: y - i * 11, size: 9, font: normal, color: PRETO });
    });
    let yDetalhe = y - linhasTexto.length * 11 + 2;
    linhasDetalhe.forEach((linha) => {
      pagina.drawText(linha, { x: MARGEM, y: yDetalhe, size: 7.5, font: normal, color: CINZA });
      yDetalhe -= 9;
    });

    const rotulo = resposta ? RESULTADO_ITEM_LABEL[resposta.resultado] : 'Não verificado';
    pagina.drawText(resposta ? fDataBr(resposta.respondidoEm) : '-', {
      x: X_DATA,
      y,
      size: 8,
      font: normal,
      color: CINZA,
    });
    pagina.drawText(sanear(rotulo), {
      x: X_RESPOSTA,
      y,
      size: 8.5,
      font: resposta?.resultado === 'NC' ? negrito : normal,
      color: resposta?.resultado === 'NC' ? VERMELHO : PRETO,
    });

    y = Math.min(yDetalhe, y - linhasTexto.length * 11) - 4;
    pagina.drawLine({
      start: { x: MARGEM, y: y + 6 },
      end: { x: MARGEM + LARGURA, y: y + 6 },
      thickness: 0.3,
      color: LINHA,
    });
    y -= 6;
    void topo;
  });

  // --- Observações gerais ---------------------------------------------------
  if (inspecao.observacoes) {
    y -= 8;
    titulo('Observações gerais');
    const linhas = quebrar(inspecao.observacoes, normal, 9, LARGURA);
    espaco(linhas.length * 11);
    linhas.forEach((linha) => {
      pagina.drawText(linha, { x: MARGEM, y, size: 9, font: normal, color: PRETO });
      y -= 11;
    });
  }

  // --- Assinatura -----------------------------------------------------------
  if (inspecao.assinatura) {
    y -= 14;
    espaco(120);
    titulo('Assinatura do inspetor');
    try {
      const png = await doc.embedPng(inspecao.assinatura.pngDataUrl);
      const escala = Math.min(200 / png.width, 60 / png.height);
      espaco(png.height * escala + 30);
      pagina.drawImage(png, {
        x: MARGEM,
        y: y - png.height * escala,
        width: png.width * escala,
        height: png.height * escala,
      });
      y -= png.height * escala + 6;
    } catch {
      y -= 6;
    }
    pagina.drawLine({
      start: { x: MARGEM, y },
      end: { x: MARGEM + 220, y },
      thickness: 0.7,
      color: LINHA,
    });
    y -= 12;
    pagina.drawText(sanear(inspecao.assinatura.nome), {
      x: MARGEM,
      y,
      size: 9,
      font: negrito,
      color: PRETO,
    });
    y -= 11;
    pagina.drawText(`Assinado em ${fDataHoraBr(inspecao.assinatura.assinadaEm)}`, {
      x: MARGEM,
      y,
      size: 8,
      font: normal,
      color: CINZA,
    });
    y -= 14;
  }

  // --- Anexo: fotos das não conformidades -----------------------------------
  const fotosNc = inspecao.fotos.filter((f) => inspecao.respostas[f.itemId]?.resultado === 'NC');
  if (fotos && fotosNc.length > 0) {
    novaPagina();
    titulo('Anexo: fotos das não conformidades');
    for (const foto of fotosNc) {
      const arquivo = fotos.get(foto.id);
      if (!arquivo) continue;
      const item = itensDaInspecao(inspecao).find((x) => x.item.id === foto.itemId)?.item;
      try {
        const imagem = arquivo.tipo.includes('png')
          ? await doc.embedPng(arquivo.bytes)
          : await doc.embedJpg(arquivo.bytes);
        const escala = Math.min(LARGURA / imagem.width, 260 / imagem.height);
        const altura = imagem.height * escala;
        espaco(altura + 26);
        pagina.drawText(sanear(item?.texto ?? 'Item'), {
          x: MARGEM,
          y,
          size: 9,
          font: negrito,
          color: PRETO,
        });
        y -= altura + 6;
        pagina.drawImage(imagem, {
          x: MARGEM,
          y,
          width: imagem.width * escala,
          height: altura,
        });
        y -= 16;
      } catch {
        // Formato que o pdf-lib não abre: segue sem a foto.
      }
    }
  }

  // --- Rodapé em todas as páginas ------------------------------------------
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    p.drawRectangle({
      x: 0,
      y: 0,
      width: A4[0],
      height: 26,
      color: FUNDO,
      opacity: 0.6,
    });
    p.drawText(sanear(`Gerado: ${geradoEm}  ${emitidoPor}`), {
      x: MARGEM,
      y: 10,
      size: 7.5,
      font: normal,
      color: CINZA,
    });
    const numero = `${i + 1}/${paginas.length}`;
    p.drawText(numero, {
      x: A4[0] - MARGEM - normal.widthOfTextAtSize(numero, 7.5),
      y: 10,
      size: 7.5,
      font: normal,
      color: CINZA,
    });
  });

  return doc.save();
}

/** Nome do arquivo: FVS-29.01.A_Porto-Horizonte_2026-09-17.pdf */
export function nomeArquivoPdf(inspecao: InspecaoFvs): string {
  const limpar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-|-$/g, '');
  const data = (inspecao.concluidaEm ?? inspecao.iniciadaEm).slice(0, 10);
  return `${limpar(inspecao.modeloCodigo ?? 'FVS')}_${limpar(inspecao.local.empreendimentoNome)}_${data}.pdf`;
}
