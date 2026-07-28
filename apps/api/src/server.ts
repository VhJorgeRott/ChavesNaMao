import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env, modoTesteClicksign, origensPermitidas } from './env.js';
import { registrarRotasClicksign } from './rotas/clicksign.js';

/**
 * API do Chaves na Mão.
 *
 * Substitui as Edge Functions do Supabase. O motivo é manutenção: um processo
 * só, com dependências normais, tipos compartilhados com o front via
 * `@chaves/domain`, e sem a dança de `verify_jwt`/preflight que já custou tempo
 * — o preflight aqui é o CORS padrão do Fastify.
 */
const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    // Não logar corpo nem headers: passam CPF, e-mail e o Authorization.
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
  trustProxy: true, // Railway termina TLS num proxy à frente
});

await app.register(cors, {
  origin: origensPermitidas,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

/** Health check — o Railway usa para saber se o deploy subiu. */
app.get('/health', async () => ({
  ok: true,
  ambiente: env.NODE_ENV,
  // Visível de propósito: é a diferença entre e-mail de teste e e-mail real
  // chegando a cliente, e precisa ser conferível sem abrir o painel.
  clicksignModoTeste: modoTesteClicksign,
}));

await registrarRotasClicksign(app);

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(
    `API no ar na porta ${env.PORT}` +
      (modoTesteClicksign ? ' — MODO TESTE: e-mails desviados' : ''),
  );
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
