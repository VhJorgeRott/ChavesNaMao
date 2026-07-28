import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createHash } from 'node:crypto';

/**
 * Geração do PDF do termo.
 *
 * `pdf-lib` desenha texto, mas não quebra linha nem pagina — isso é feito aqui,
 * medindo cada palavra na fonte real.
 */

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56; // ~2 cm
const TAMANHO = 10;
const ENTRELINHA = 14;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

interface Medidor {
  widthOfTextAtSize(t: string, s: number): number;
}

function quebrarLinhas(texto: string, fonte: Medidor): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    if (paragrafo.trim() === '') {
      linhas.push('');
      continue;
    }
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual === '' ? palavra : `${atual} ${palavra}`;
      if (fonte.widthOfTextAtSize(tentativa, TAMANHO) <= LARGURA_UTIL) {
        atual = tentativa;
        continue;
      }
      if (atual !== '') linhas.push(atual);
      // Palavra sozinha maior que a linha inteira: corta no que couber.
      let resto = palavra;
      while (fonte.widthOfTextAtSize(resto, TAMANHO) > LARGURA_UTIL) {
        let corte = resto.length;
        while (corte > 1 && fonte.widthOfTextAtSize(resto.slice(0, corte), TAMANHO) > LARGURA_UTIL) {
          corte -= 1;
        }
        linhas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

/**
 * Troca o que a fonte padrão (WinAnsi) não codifica.
 *
 * Termo jurídico costuma vir colado do Word, com travessão e aspas
 * tipográficas. Um único caractere fora da tabela derruba a geração inteira com
 * erro de encoding — e derrubaria bem no meio de uma entrega.
 */
function sanitizar(t: string): string {
  return t
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

export interface TermoGerado {
  pdf: Buffer;
  /** sha256 do ARQUIVO — não de uma string qualquer. */
  sha256: string;
  paginas: number;
}

export async function gerarTermoPdf(titulo: string, corpo: string): Promise<TermoGerado> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteTitulo = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdf.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;

  pagina.drawText(sanitizar(titulo), {
    x: MARGEM,
    y,
    size: 13,
    font: fonteTitulo,
    color: rgb(0, 0, 0),
  });
  y -= ENTRELINHA * 2;

  for (const linha of quebrarLinhas(sanitizar(corpo), fonte)) {
    if (y < MARGEM) {
      pagina = pdf.addPage([A4.largura, A4.altura]);
      y = A4.altura - MARGEM;
    }
    if (linha !== '') {
      pagina.drawText(linha, { x: MARGEM, y, size: TAMANHO, font: fonte, color: rgb(0, 0, 0) });
    }
    y -= ENTRELINHA;
  }

  pdf.setTitle(titulo);
  pdf.setProducer('Chaves na Mão — Rottas');
  pdf.setCreationDate(new Date());

  const bytes = Buffer.from(await pdf.save());
  return {
    pdf: bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    paginas: pdf.getPageCount(),
  };
}
