/**
 * Extrai o motivo real de uma falha de Edge Function.
 *
 * O supabase-js embrulha respostas não-2xx num `FunctionsHttpError` cujo
 * `message` é genérico ("Edge Function returned a non-2xx status code"); o corpo
 * que a função devolveu — onde está a causa — fica em `error.context`, um
 * `Response` ainda não lido.
 *
 * Sem passar por aqui, o usuário vê "Falha ao gerar o link" e ninguém descobre
 * que era violação de constraint, papel faltando ou token vencido. Já custou
 * caro mais de uma vez: vale usar em TODO adapter que invoca função.
 */
export async function detalheErroFuncao(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body: unknown = await ctx.clone().json();
      if (body && typeof body === 'object') {
        const b = body as { error?: unknown; message?: unknown; detalhe?: unknown; alvo?: unknown };
        const partes = [b.error, b.message, b.detalhe, b.alvo]
          .filter((v) => typeof v === 'string' && v.trim() !== '')
          .map((v) => String(v).trim());
        // `error` costuma ser o código ("internal") e `message` o motivo — os
        // dois juntos são o que realmente explica a falha.
        if (partes.length) return [...new Set(partes)].join(' — ');
      }
    } catch {
      try {
        const txt = (await ctx.clone().text()).trim();
        if (txt) return txt.slice(0, 300);
      } catch {
        /* corpo já consumido ou ilegível */
      }
    }
  }
  return error instanceof Error ? error.message : '';
}
