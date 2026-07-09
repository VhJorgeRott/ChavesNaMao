/**
 * Registro de atividade do usuário no audit_log (Supabase).
 *
 * Só persiste quando há backend de auth configurado e uma sessão ativa — a RLS
 * `audit_log_insert_self` garante que o usuário só grava linhas atribuídas a si
 * mesmo (actor = auth.uid). Em modo dev/mock é um no-op silencioso.
 *
 * É deliberadamente "fire-and-forget": nunca lança nem bloqueia a UI; uma falha
 * de rede/RLS no log jamais deve quebrar o fluxo do usuário.
 */
import { getSupabase } from './supabase';
import { isAuthConfigured } from '@/auth/authConfig';

export interface EventoAtividade {
  action: string;
  entity?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** `audit_log.entity_id` é `uuid` no Postgres; ids em memória (ex.: `ent-1a2b`) não são. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logAtividade(ev: EventoAtividade): Promise<void> {
  if (!isAuthConfigured) return;
  try {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    // Só grava `entity_id` quando for UUID (linha real no banco). Ids sintéticos
    // do store em memória iriam para uma coluna `uuid` e o Postgres rejeitaria
    // com 400 — nesses casos preservamos a referência dentro do metadata.
    const entityId = ev.entityId ?? null;
    const isUuid = entityId != null && UUID_RE.test(entityId);
    const metadata =
      entityId != null && !isUuid
        ? { ...(ev.metadata ?? {}), entityRef: entityId }
        : (ev.metadata ?? {});
    await sb.from('audit_log').insert({
      actor: uid,
      action: ev.action,
      entity: ev.entity ?? 'app',
      entity_id: isUuid ? entityId : null,
      metadata,
    });
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[atividade] falha ao registrar', e);
  }
}
