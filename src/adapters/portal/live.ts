import { env } from '@/lib/env';
import { buildPortalUrl } from '@/lib/token';
import { getSupabase } from '@/lib/supabase';
import { AdapterError } from '../errors';
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
      throw new AdapterError('Falha ao gerar o link de assinatura', { cause: error });
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
