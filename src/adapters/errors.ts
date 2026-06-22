/** Erros da camada de adapters — tratados explicitamente, nunca engolidos. */

export class AdapterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AdapterError';
  }
}

export class AdapterNotFoundError extends AdapterError {
  constructor(recurso: string, id: string) {
    super(`${recurso} não encontrado: ${id}`);
    this.name = 'AdapterNotFoundError';
  }
}

/** Marca uma implementação `live` ainda não conectada à API real. */
export class AdapterNotImplementedError extends AdapterError {
  constructor(adapter: string) {
    super(
      `${adapter}: implementação live ainda não conectada. ` +
        `Configure as credenciais no servidor e implemente a chamada à API real.`,
    );
    this.name = 'AdapterNotImplementedError';
  }
}
