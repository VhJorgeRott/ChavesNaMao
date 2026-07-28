import { z } from 'zod';

/**
 * Configuração do servidor, validada na partida.
 *
 * Falhar aqui, alto e cedo, é deliberado: a alternativa é o processo subir e só
 * quebrar quando alguém tenta enviar um termo — que é o pior momento possível
 * para descobrir que faltava um secret.
 *
 * Nada aqui tem prefixo VITE_: são segredos de servidor. No Railway, entram como
 * variáveis do serviço da API, nunca do front.
 */
const schema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /** Origens autorizadas no CORS, separadas por vírgula. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Supabase — a API usa a service_role e é a única que a possui. */
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Usada só para validar o JWT do usuário que chega do front. */
  SUPABASE_ANON_KEY: z.string().min(1),

  /** Clicksign. Ausentes → a rota de envio responde 503 em vez de quebrar. */
  CLICKSIGN_API_TOKEN: z.string().optional(),
  CLICKSIGN_API_BASE_URL: z.string().url().optional(),
  /**
   * Enquanto definido, TODO e-mail de signatário é substituído por este
   * endereço. É a trava que impede um termo de teste chegar a cliente real —
   * some do caminho ao remover a variável.
   */
  CLICKSIGN_EMAIL_TESTE: z.string().email().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const faltando = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Configuração inválida:\n${faltando.join('\n')}`);
}

export const env = parsed.data;

export const origensPermitidas: string[] = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

export const clicksignConfigurada: boolean =
  env.CLICKSIGN_API_TOKEN !== undefined && env.CLICKSIGN_API_BASE_URL !== undefined;

/** Modo de teste da Clicksign: nenhum e-mail sai para o cliente final. */
export const modoTesteClicksign: boolean = env.CLICKSIGN_EMAIL_TESTE !== undefined;
