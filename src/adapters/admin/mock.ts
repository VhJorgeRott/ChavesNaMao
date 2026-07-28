import type { AppUser, AuditEntry } from '@chaves/domain/types';
import { ACAO_NAVEGACAO, ACOES_LOGIN } from '@chaves/domain/atividade';
import type { AdminAdapter, AtividadeFiltro, AtividadePagina } from '../types';

/**
 * Admin (mock): usuários e trilha de atividade sintéticos, para o app rodar sem
 * Supabase. Cobre os três tipos de evento (login, navegação e ação) e volume
 * suficiente para exercitar a paginação da tela de atividade.
 */

const TAMANHO_PADRAO = 20;

const USUARIOS: AppUser[] = [
  {
    id: 'usr-admin',
    nome: 'Vitor Jorge',
    email: 'vitor.jorge@rottas.com.br',
    papel: 'admin',
    ultimaAtividade: '2026-06-22T13:00:00Z',
    avatarUrl: null,
    criadoEm: '2025-11-10T09:00:00Z',
  },
  {
    id: 'usr-equipe',
    nome: 'João da Silva',
    email: 'joao.silva@rottas.com.br',
    papel: 'equipe_entrega',
    ultimaAtividade: '2026-06-21T18:20:00Z',
    avatarUrl: null,
    criadoEm: '2026-01-15T14:30:00Z',
  },
];

/** Gera N eventos decrescentes no tempo a partir de uma base, para dar volume. */
function gerarAtividade(): AuditEntry[] {
  const base = Date.parse('2026-06-22T13:00:00Z');
  const rotas = ['/dashboard', '/unidades', '/unidades/2', '/entregas', '/modelos'];
  const eventos: AuditEntry[] = [];

  // usr-equipe: login + 24 navegações/ações, para paginar (2+ páginas de 20).
  eventos.push({
    id: 'aud-e-login',
    actor: 'usr-equipe',
    action: 'auth.login',
    entity: 'auth',
    entityId: null,
    metadata: {},
    at: new Date(base - 26 * 60000).toISOString(),
  });
  for (let i = 0; i < 24; i += 1) {
    const acao = i % 5 === 0;
    eventos.push(
      acao
        ? {
            id: `aud-e-acao-${i}`,
            actor: 'usr-equipe',
            action: 'ENTREGA_INICIADA',
            entity: 'entrega',
            entityId: `ent-${1000 + i}`,
            metadata: { unidade: `uni-${1000 + i}` },
            at: new Date(base - (25 - i) * 60000).toISOString(),
          }
        : {
            id: `aud-e-nav-${i}`,
            actor: 'usr-equipe',
            action: 'page.view',
            entity: 'route',
            entityId: null,
            metadata: { path: rotas[i % rotas.length], title: 'Chaves na Mão' },
            at: new Date(base - (25 - i) * 60000).toISOString(),
          },
    );
  }

  // usr-admin: alguns eventos.
  eventos.push(
    {
      id: 'aud-a-login',
      actor: 'usr-admin',
      action: 'auth.login',
      entity: 'auth',
      entityId: null,
      metadata: {},
      at: new Date(base).toISOString(),
    },
    {
      id: 'aud-a-nav',
      actor: 'usr-admin',
      action: 'page.view',
      entity: 'route',
      entityId: null,
      metadata: { path: '/unidades/2', title: 'Unidades' },
      at: new Date(base + 70000).toISOString(),
    },
  );

  return eventos;
}

const ATIVIDADE = gerarAtividade();

function tipoBate(action: string, tipo: NonNullable<AtividadeFiltro['tipo']>): boolean {
  if (tipo === 'login') return (ACOES_LOGIN as readonly string[]).includes(action);
  if (tipo === 'navegacao') return action === ACAO_NAVEGACAO;
  return !(ACOES_LOGIN as readonly string[]).includes(action) && action !== ACAO_NAVEGACAO;
}

export class MockAdminAdapter implements AdminAdapter {
  async getUsuarios(): Promise<AppUser[]> {
    return USUARIOS.map((u) => ({ ...u }));
  }

  async getAtividade(filtro?: AtividadeFiltro): Promise<AtividadePagina> {
    const tamanho = filtro?.tamanho ?? TAMANHO_PADRAO;
    const pagina = filtro?.pagina ?? 0;

    const filtradas = ATIVIDADE.filter((e) => {
      if (filtro?.actor && e.actor !== filtro.actor) return false;
      if (filtro?.tipo && !tipoBate(e.action, filtro.tipo)) return false;
      if (filtro?.dataDe && e.at < filtro.dataDe) return false;
      if (filtro?.dataAte && e.at > filtro.dataAte) return false;
      if (filtro?.rota) {
        const path = typeof e.metadata.path === 'string' ? e.metadata.path : '';
        if (!path.toLowerCase().includes(filtro.rota.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.at.localeCompare(a.at));

    const from = pagina * tamanho;
    return {
      itens: filtradas.slice(from, from + tamanho),
      temMais: filtradas.length > from + tamanho,
    };
  }
}
