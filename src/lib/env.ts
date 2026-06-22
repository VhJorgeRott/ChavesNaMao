import { z } from 'zod';

/**
 * Validação do ambiente do CLIENTE (apenas variáveis VITE_*, que são públicas).
 *
 * Segredos (service_role, API keys, client_secret, HMAC) NÃO entram aqui — eles
 * vivem no servidor (Supabase Edge Functions / host) e nunca tocam o bundle.
 *
 * A validação roda uma vez no import; se algo obrigatório faltar, a app falha
 * cedo e de forma explícita em vez de quebrar silenciosamente em runtime.
 */
const clientEnvSchema = z.object({
  VITE_ADAPTER_MODE: z.enum(['mock', 'live']).default('mock'),
  // Opcionais: em ADAPTER_MODE=mock o Supabase não é usado. São exigidos só
  // quando o cliente Supabase é efetivamente instanciado (ver lib/supabase.ts).
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_ENTRA_CLIENT_ID: z.string().min(1).optional(),
  VITE_ENTRA_TENANT_ID: z.string().min(1).optional(),
  VITE_ENTRA_REDIRECT_URI: z.string().url().optional(),
  VITE_PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AdapterMode = ClientEnv['VITE_ADAPTER_MODE'];

function loadEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    // Não logamos os valores — apenas quais chaves falharam.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Configuração de ambiente inválida. Cheque seu .env (veja .env.example):\n${issues}`,
    );
  }
  return parsed.data;
}

export const env: ClientEnv = loadEnv();
