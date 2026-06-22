/**
 * Seletor de adapters por ambiente. Resolve mock|live a partir de
 * `VITE_ADAPTER_MODE` e expõe um único ponto de acesso às integrações.
 *
 * Trocar de mock para live não exige mudanças fora desta camada.
 */

import type { AdapterMode } from '@/lib/env';
import { env } from '@/lib/env';
import type { Adapters } from './types';

import { MockCrmAdapter } from './crm/mock';
import { LiveCrmAdapter } from './crm/live';
import { MockErpAdapter } from './erp/mock';
import { LiveErpAdapter } from './erp/live';
import { MockClicksignAdapter } from './signature/mock';
import { LiveClicksignAdapter } from './signature/live';
import { MockNotificationAdapter } from './notification/mock';
import { LiveNotificationAdapter } from './notification/live';

export function createAdapters(mode: AdapterMode): Adapters {
  if (mode === 'live') {
    return {
      crm: new LiveCrmAdapter(),
      erp: new LiveErpAdapter(),
      signature: new LiveClicksignAdapter(),
      notification: new LiveNotificationAdapter(),
    };
  }
  return {
    crm: new MockCrmAdapter(),
    erp: new MockErpAdapter(),
    signature: new MockClicksignAdapter(),
    notification: new MockNotificationAdapter(),
  };
}

/** Conjunto de adapters resolvido para o modo atual. */
export const adapters: Adapters = createAdapters(env.VITE_ADAPTER_MODE);

export * from './types';
export * from './errors';
