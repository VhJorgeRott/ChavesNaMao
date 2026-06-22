/**
 * Lógica de tokens do portal do cliente (superfície crítica — seção 8.2).
 *
 * Regras aplicadas:
 *  - Alta entropia: 256 bits via CSPRNG (crypto.getRandomValues). Nunca sequencial.
 *  - Armazena-se APENAS o hash (SHA-256) no banco; o token em claro só existe no
 *    link enviado ao cliente.
 *  - Comparação em tempo constante para evitar timing attacks.
 *  - Expiração curta e uso único (validados aqui + reforçados no servidor/RLS).
 *
 * Usa Web Crypto (disponível no navegador e no Node 20+). A geração real do token
 * e a gravação do hash devem ocorrer no SERVIDOR (Edge Function com service_role);
 * estas funções puras são compartilhadas e testáveis.
 */

const TOKEN_BYTES = 32; // 256 bits

/** Codifica bytes em base64url (sem padding) — seguro para URL. */
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const base64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface GeneratedToken {
  /** Token em claro — vai SOMENTE no link; nunca é persistido. */
  token: string;
  /** Hash SHA-256 (hex) — é isto que se grava em access_tokens.token_hash. */
  tokenHash: string;
}

/** Gera um token de alta entropia e seu hash. */
export async function generateToken(): Promise<GeneratedToken> {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const token = toBase64Url(bytes);
  const tokenHash = await hashToken(token);
  return { token, tokenHash };
}

/** Calcula o hash SHA-256 (hex) de um token em claro. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/**
 * Compara dois hashes (hex) em tempo constante.
 * Retorna false imediatamente só para tamanhos diferentes (que não vazam o token).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Monta o link público do portal a partir do token em claro. */
export function buildPortalUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/portal/${encodeURIComponent(token)}`;
}

export interface TokenRecord {
  tokenHash: string;
  expiresAt: string; // ISO
  usedAt: string | null; // ISO ou null
}

export type TokenValidacao =
  | { ok: true }
  | { ok: false; motivo: 'invalido' | 'expirado' | 'usado' };

/**
 * Valida um token apresentado contra o registro persistido.
 *
 * Importante (8.2): para não vazar a existência de tokens, o CHAMADOR deve
 * devolver uma resposta HTTP idêntica para 'invalido', 'expirado' e 'usado'.
 * O `motivo` aqui é só para auditoria/log interno (sem vazar ao cliente).
 */
export async function validarToken(
  tokenApresentado: string,
  registro: TokenRecord | null,
  agora: Date = new Date(),
): Promise<TokenValidacao> {
  if (!registro) return { ok: false, motivo: 'invalido' };

  const hashApresentado = await hashToken(tokenApresentado);
  if (!timingSafeEqualHex(hashApresentado, registro.tokenHash)) {
    return { ok: false, motivo: 'invalido' };
  }
  if (registro.usedAt !== null) return { ok: false, motivo: 'usado' };
  if (new Date(registro.expiresAt).getTime() <= agora.getTime()) {
    return { ok: false, motivo: 'expirado' };
  }
  return { ok: true };
}
