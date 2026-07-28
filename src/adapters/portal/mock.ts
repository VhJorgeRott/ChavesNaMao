import { env } from '@/lib/env';
import { buildPortalUrl, generateToken, hashToken } from '@/lib/token';
import type {
  PortalAdapter,
  PortalAssinarInput,
  PortalAssinarResult,
  PortalDelivery,
  PortalResolveResult,
  PortalSnapshot,
} from '../types';

/**
 * Portal (mock). Guarda tokens e snapshots em memória do módulo — persiste
 * durante a sessão do app (mesmo comportamento anterior: some ao recarregar a
 * página, o que é aceitável no mock). O fluxo real entre dispositivos exige o
 * adapter `live` (Edge Functions + Postgres).
 */

interface Registro {
  tokenHash: string;
  entregaId: string;
  expiresAt: number;
  usedAt: number | null;
  delivery: PortalDelivery;
}

const porEntrega = new Map<string, Registro>();
const porHash = new Map<string, Registro>();

const valido = (r: Registro | undefined): r is Registro =>
  !!r && r.usedAt === null && r.expiresAt > Date.now();

export class MockPortalAdapter implements PortalAdapter {
  async gerarLink(snapshot: PortalSnapshot): Promise<{ token: string; url: string }> {
    const { token, tokenHash } = await generateToken();
    const entregaId = snapshot.entrega.externalRef;

    // Invalida o token anterior da mesma entrega (uso único + escopo mínimo).
    const anterior = porEntrega.get(entregaId);
    if (anterior) porHash.delete(anterior.tokenHash);

    const registro: Registro = {
      tokenHash,
      entregaId,
      expiresAt: Date.now() + 72 * 3600 * 1000,
      usedAt: null,
      delivery: {
        entregaId,
        cliente: { nome: snapshot.cliente.nome, cpf: snapshot.cliente.cpf },
        unidade: {
          identificacao: snapshot.unidade.identificacao,
          areaM2: snapshot.unidade.areaM2,
        },
        empreendimento: {
          nome: snapshot.empreendimento.nome,
          cidade: snapshot.empreendimento.cidade,
          uf: snapshot.empreendimento.uf,
        },
      },
    };
    porEntrega.set(entregaId, registro);
    porHash.set(tokenHash, registro);

    return { token, url: buildPortalUrl(env.VITE_PUBLIC_APP_URL, token) };
  }

  async resolver(token: string): Promise<PortalResolveResult> {
    const reg = porHash.get(await hashToken(token));
    return valido(reg) ? { ok: true, delivery: reg.delivery } : { ok: false };
  }

  async registrarAssinatura(input: PortalAssinarInput): Promise<PortalAssinarResult> {
    const reg = porHash.get(await hashToken(input.token));
    if (!valido(reg)) return { ok: false };
    reg.usedAt = Date.now(); // uso único
    return { ok: true, entregaId: reg.entregaId };
  }

  /** Sem storage no mock: nada a servir, e a tela cai para a renderização local. */
  async urlArquivo(): Promise<string | null> {
    return null;
  }
}
