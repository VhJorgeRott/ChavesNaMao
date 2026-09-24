import { afterEach, describe, expect, it, vi } from 'vitest';
import { comCache, lerCache, limparCache } from './cache-memoria';

afterEach(() => {
  limparCache();
  vi.useRealTimers();
});

describe('cache-memoria', () => {
  it('serve do cache dentro do TTL e busca de novo depois dele', async () => {
    vi.useFakeTimers();
    const buscar = vi.fn(async () => 'v');
    await comCache('a', buscar);
    await comCache('a', buscar);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(lerCache('a')).toBe('v');

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(lerCache('a')).toBeUndefined();
    await comCache('a', buscar);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('não cacheia erro', async () => {
    await expect(comCache('b', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(comCache('b', async () => 'ok')).resolves.toBe('ok');
  });

  it('limpa só o prefixo pedido', async () => {
    await comCache('chamados:1', async () => 1);
    await comCache('atividade:1', async () => 2);
    limparCache('chamados:');
    expect(lerCache('chamados:1')).toBeUndefined();
    expect(lerCache('atividade:1')).toBe(2);
  });
});
