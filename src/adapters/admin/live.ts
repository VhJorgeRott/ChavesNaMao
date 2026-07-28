import type { AppUser } from '@chaves/domain/types';
import { ACAO_NAVEGACAO, ACOES_LOGIN } from '@chaves/domain/atividade';
import type { AdminAdapter, AtividadeFiltro, AtividadePagina } from '../types';
import { AdapterError } from '../errors';
import { adminUsuarioRowSchema, auditLogRowSchema } from '../schemas';
import { getSupabase } from '@/lib/supabase';

const TAMANHO_PADRAO = 20;

/**
 * Admin (live). Usuários vêm da RPC `admin_list_users` (SECURITY DEFINER, lê
 * auth.users; só retorna linhas para quem é admin). A trilha de atividade vem
 * direto de `audit_log` — o RLS `audit_log_select_admin` garante que apenas
 * administradores leem.
 */
export class LiveAdminAdapter implements AdminAdapter {
  async getUsuarios(): Promise<AppUser[]> {
    const { data, error } = await getSupabase().rpc('admin_list_users');
    if (error) throw new AdapterError('Falha ao listar usuários', error);
    return adminUsuarioRowSchema
      .array()
      .parse(data)
      .map((r) => ({
        id: r.id,
        nome: r.nome ?? r.email ?? 'Usuário',
        email: r.email ?? '',
        papel: r.papel,
        ultimaAtividade: r.last_sign_in_at,
        avatarUrl: r.avatar_url,
        criadoEm: r.created_at,
      }));
  }

  async getAtividade(filtro?: AtividadeFiltro): Promise<AtividadePagina> {
    const tamanho = filtro?.tamanho ?? TAMANHO_PADRAO;
    const pagina = filtro?.pagina ?? 0;
    const from = pagina * tamanho;

    let query = getSupabase()
      .from('audit_log')
      .select('id, actor, action, entity, entity_id, metadata, at')
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      // Pede uma linha a mais que a página para saber se há próxima.
      .range(from, from + tamanho);

    if (filtro?.actor) query = query.eq('actor', filtro.actor);
    if (filtro?.tipo === 'login') query = query.in('action', [...ACOES_LOGIN]);
    else if (filtro?.tipo === 'navegacao') query = query.eq('action', ACAO_NAVEGACAO);
    else if (filtro?.tipo === 'acao')
      query = query.not('action', 'in', `(${[...ACOES_LOGIN, ACAO_NAVEGACAO].join(',')})`);
    if (filtro?.dataDe) query = query.gte('at', filtro.dataDe);
    if (filtro?.dataAte) query = query.lte('at', filtro.dataAte);
    if (filtro?.rota) query = query.ilike('metadata->>path', `%${filtro.rota}%`);

    const { data, error } = await query;
    if (error) throw new AdapterError('Falha ao carregar a atividade', error);

    const linhas = auditLogRowSchema.array().parse(data);
    const temMais = linhas.length > tamanho;
    return {
      temMais,
      itens: linhas.slice(0, tamanho).map((r) => ({
        id: r.id,
        actor: r.actor,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        metadata: r.metadata,
        at: r.at,
      })),
    };
  }
}
