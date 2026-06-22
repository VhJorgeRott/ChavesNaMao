import { describe, expect, it } from 'vitest';
import {
  buildPortalUrl,
  generateToken,
  hashToken,
  timingSafeEqualHex,
  validarToken,
  type TokenRecord,
} from './token';

describe('geração de token', () => {
  it('gera token de alta entropia (>= 256 bits, base64url ~43 chars)', async () => {
    const { token } = await generateToken();
    // 32 bytes em base64url sem padding => 43 caracteres.
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // url-safe, sem +, / ou =
  });

  it('nunca produz dois tokens iguais', async () => {
    const tokens = await Promise.all(Array.from({ length: 100 }, () => generateToken()));
    const claros = new Set(tokens.map((t) => t.token));
    const hashes = new Set(tokens.map((t) => t.tokenHash));
    expect(claros.size).toBe(100);
    expect(hashes.size).toBe(100);
  });

  it('o hash bate com hashToken(token) e nunca é o próprio token', async () => {
    const { token, tokenHash } = await generateToken();
    expect(tokenHash).toBe(await hashToken(token));
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
  });
});

describe('hashToken', () => {
  it('é determinístico', async () => {
    expect(await hashToken('abc')).toBe(await hashToken('abc'));
  });
  it('vetor de teste conhecido de SHA-256("abc")', async () => {
    expect(await hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('timingSafeEqualHex', () => {
  it('true para iguais, false para diferentes', () => {
    expect(timingSafeEqualHex('deadbeef', 'deadbeef')).toBe(true);
    expect(timingSafeEqualHex('deadbeef', 'deadbef0')).toBe(false);
  });
  it('false para tamanhos diferentes', () => {
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });
});

describe('buildPortalUrl', () => {
  it('monta a URL do portal sem barra dupla', () => {
    expect(buildPortalUrl('https://app.exemplo.com/', 'TOK')).toBe(
      'https://app.exemplo.com/portal/TOK',
    );
    expect(buildPortalUrl('https://app.exemplo.com', 'TOK')).toBe(
      'https://app.exemplo.com/portal/TOK',
    );
  });
});

describe('validarToken', () => {
  const futuro = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const passado = new Date(Date.now() - 1000).toISOString();

  async function registroPara(token: string, over: Partial<TokenRecord> = {}): Promise<TokenRecord> {
    return { tokenHash: await hashToken(token), expiresAt: futuro, usedAt: null, ...over };
  }

  it('aceita token válido, não usado e não expirado', async () => {
    const { token } = await generateToken();
    expect(await validarToken(token, await registroPara(token))).toEqual({ ok: true });
  });

  it('rejeita quando não há registro (invalido)', async () => {
    expect(await validarToken('qualquer', null)).toEqual({ ok: false, motivo: 'invalido' });
  });

  it('rejeita token que não bate com o hash (invalido)', async () => {
    const reg = await registroPara('token-correto');
    expect(await validarToken('token-errado', reg)).toEqual({ ok: false, motivo: 'invalido' });
  });

  it('rejeita token já usado', async () => {
    const { token } = await generateToken();
    const reg = await registroPara(token, { usedAt: new Date().toISOString() });
    expect(await validarToken(token, reg)).toEqual({ ok: false, motivo: 'usado' });
  });

  it('rejeita token expirado', async () => {
    const { token } = await generateToken();
    const reg = await registroPara(token, { expiresAt: passado });
    expect(await validarToken(token, reg)).toEqual({ ok: false, motivo: 'expirado' });
  });
});
