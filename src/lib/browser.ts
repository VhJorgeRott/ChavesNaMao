/** Utilitários de browser para o MVP (download de prévia, clipboard). */

/** Dispara o download de um texto como arquivo (prévia mock do termo). */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Abre o conteúdo do termo numa janela de impressão formatada (A4). O navegador
 * permite salvar como PDF a partir do diálogo de impressão — assim geramos um
 * documento real sem depender de biblioteca de PDF no cliente.
 */
export function imprimirDocumento(titulo: string, conteudo: string): void {
  // Sem `noopener` de propósito: precisamos escrever no documento da nova janela.
  const win = window.open('', '_blank', 'width=820,height=1060');
  if (!win) return; // popup bloqueado — o chamador pode alertar o usuário

  const escapar = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  win.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<title>${escapar(titulo)}</title>` +
      `<style>` +
      `@page { size: A4; margin: 25mm; }` +
      `body { font-family: Georgia, 'Times New Roman', serif; color: #111; ` +
      `line-height: 1.6; font-size: 12pt; margin: 0; }` +
      `.doc { white-space: pre-wrap; word-wrap: break-word; }` +
      `</style></head><body>` +
      `<div class="doc">${escapar(conteudo)}</div>` +
      `<script>window.onload=function(){window.focus();window.print();};</script>` +
      `</body></html>`,
  );
  win.document.close();
}

/** Copia texto para a área de transferência; retorna true em sucesso. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
