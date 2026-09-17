/**
 * Reduz a foto antes de guardar/enviar. Câmera de celular gera 3–8 MB por foto;
 * numa FVS com várias fotos isso esgota o armazenamento do aparelho e demora a
 * subir com o sinal fraco da obra. 1600 px no maior lado mantém legível o
 * detalhe de uma trinca ou de um desnível, com ~300 KB.
 */
const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.8;

export async function comprimirImagem(arquivo: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG),
    );
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC em alguns Androids):
    // guarda o original em vez de perder a evidência.
    return arquivo;
  }
}
