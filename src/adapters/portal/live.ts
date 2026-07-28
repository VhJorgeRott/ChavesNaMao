import { env } from '@/lib/env';
import { buildPortalUrl } from '@/lib/token';
import { getSupabase } from '@/lib/supabase';
import { AdapterError } from '../errors';
import { detalheErroFuncao } from '../erro-funcao';
import type {
  PortalAdapter,
  PortalAssinarInput,
  PortalAssinarResult,
  PortalResolveResult,
  PortalSnapshot,
} from '../types';

/**
 * Portal (live). Toda a lógica sensível de token vive no servidor: o navegador
 * apenas invoca as Edge Functions.
 *  - `portal-gerar-link` (admin autenticado): persiste o grafo + token.
 *  - `portal-resolver` / `portal-assinar` (cliente anônimo): validam pelo token.
 *
 * As respostas de resolver/assinar são SEMPRE genéricas quando inválidas — não
 * distinguimos inválido/expirado/usado para não vazar a existência do token.
 */
export class LivePortalAdapter implements PortalAdapter {
  async gerarLink(snapshot: PortalSnapshot): Promise<{ token: string; url: string }> {
    const { data, error } = await getSupabase().functions.invoke('portal-gerar-link', {
      body: snapshot,
    });
    if (error) {
      // Sem o detalhe do corpo, o usuário via só "Falha ao gerar o link" e a
      // causa (constraint, papel, transição inválida) se perdia.
      const detalhe = await detalheErroFuncao(error);
      throw new AdapterError(
        `Falha ao gerar o link de assinatura${detalhe ? `: ${detalhe}` : ''}`,
        { cause: error },
      );
    }
    const token = (data as { token?: unknown } | null)?.token;
    if (typeof token !== 'string' || !token) {
      throw new AdapterError('Resposta inválida do servidor ao gerar o link', { cause: data });
    }
    return { token, url: buildPortalUrl(env.VITE_PUBLIC_APP_URL, token) };
  }

  async resolver(token: string): Promise<PortalResolveResult> {
    const { data, error } = await getSupabase().functions.invoke('portal-resolver', {
      body: { token },
    });
    if (error) return { ok: false };
    const d = data as PortalResolveResult | null;
    return d && d.ok ? d : { ok: false };
  }

  async urlArquivo(entregaId: string, alvo: string): Promise<string | null> {
    const { data, error } = await getSupabase().functions.invoke('arquivo-entrega', {
      body: { entregaId, alvo },
    });
    // 404 (arquivo/assinatura ausente) não é falha: é "ainda não existe", e quem
    // chama decide o que fazer. Só propagamos o que for erro de verdade.
    if (error) {
      const detalhe = await detalheErroFuncao(error);
      if (/ausente|não encontrada/i.test(detalhe)) return null;
      throw new AdapterError(`Falha ao abrir o arquivo${detalhe ? `: ${detalhe}` : ''}`, {
        cause: error,
      });
    }
    const url = (data as { url?: unknown } | null)?.url;
    return typeof url === 'string' && url ? url : null;
  }

  async registrarAssinatura(input: PortalAssinarInput): Promise<PortalAssinarResult> {
    const { data, error } = await getSupabase().functions.invoke('portal-assinar', {
      body: {
        token: input.token,
        pngBase64: input.pngDataUrl,
        geo: input.geo,
        userAgent: input.userAgent,
      },
    });
    if (error) return { ok: false };
    const d = data as PortalAssinarResult | null;
    return d && d.ok ? d : { ok: false };
  }
}
