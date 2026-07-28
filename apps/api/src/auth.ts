import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './env.js';

/**
 * Autenticação e autorização da API.
 *
 * O front continua logando via Entra → Supabase e recebe um JWT. Aqui esse JWT é
 * validado contra o Supabase e o papel do usuário é lido de `user_roles`.
 *
 * A diferença para o desenho anterior é onde mora a confiança: antes o navegador
 * escrevia direto no banco e a RLS era o portão; agora o portão é este processo,
 * que fala com o banco pela service_role. A RLS continua ligada como defesa em
 * profundidade — se esta camada falhar, o banco ainda recusa.
 */

/** Cliente com service_role: ignora RLS. Nunca exposto a partir de uma rota. */
export const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type Papel = 'admin' | 'equipe_entrega';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  papel: Papel;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

function extrairToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 ? token : null;
}

/**
 * Exige usuário autenticado COM papel interno atribuído.
 *
 * Sem papel em `user_roles` a pessoa não é da equipe — autenticar no Entra não
 * basta, senão qualquer conta do tenant entraria. É o mesmo critério do
 * `is_equipe()` usado pela RLS.
 */
export async function exigirEquipe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extrairToken(req);
  if (!token) {
    await reply.code(401).send({ erro: 'não autenticado' });
    return;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    await reply.code(401).send({ erro: 'sessão inválida' });
    return;
  }

  const { data: papelRow } = await admin
    .from('user_roles')
    .select('papel')
    .eq('user_id', data.user.id)
    .maybeSingle();

  const papel = papelRow?.papel as Papel | undefined;
  if (!papel) {
    await reply.code(403).send({ erro: 'usuário sem papel atribuído' });
    return;
  }

  req.usuario = { id: data.user.id, email: data.user.email ?? '', papel };
}

/** Exige papel de administrador, além de equipe. Use depois de `exigirEquipe`. */
export async function exigirAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await exigirEquipe(req, reply);
  if (reply.sent) return;
  if (req.usuario?.papel !== 'admin') {
    await reply.code(403).send({ erro: 'exige papel de administrador' });
  }
}
