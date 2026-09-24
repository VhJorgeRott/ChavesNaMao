/**
 * Serialização de CSV para exportações da UI.
 *
 * Separador `;` porque o Excel em pt-BR usa vírgula como decimal. Todo campo vai
 * entre aspas — nome de cliente com `;`, aspas ou quebra de linha quebraria as
 * colunas em silêncio. BOM no início para o Excel reconhecer UTF-8.
 */
export function montarCsv(linhas: readonly (readonly string[])[]): string {
  const campo = (c: string): string => `"${c.replace(/"/g, '""')}"`;
  return `\uFEFF${linhas.map((l) => l.map(campo).join(';')).join('\r\n')}`;
}

/** Dispara o download de um CSV montado em memória (sem dependência externa). */
export function baixarCsv(nome: string, linhas: readonly (readonly string[])[]): void {
  const url = URL.createObjectURL(
    new Blob([montarCsv(linhas)], { type: 'text/csv;charset=utf-8;' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
