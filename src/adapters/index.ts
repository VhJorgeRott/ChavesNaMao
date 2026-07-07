/**
 * Seletor de adapters. Resolve mock|live por integração a partir do env,
 * permitindo migrar uma de cada vez (ex.: CRM em `live`, resto em `mock`).
 * A ordem de precedência é: override da integração > VITE_ADAPTER_MODE global.
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

const makeCrm = (m: AdapterMode) => (m === 'live' ? new LiveCrmAdapter() : new MockCrmAdapter());
const makeErp = (m: AdapterMode) => (m === 'live' ? new LiveErpAdapter() : new MockErpAdapter());
const makeSignature = (m: AdapterMode) =>
  m === 'live' ? new LiveClicksignAdapter() : new MockClicksignAdapter();
const makeNotification = (m: AdapterMode) =>
  m === 'live' ? new LiveNotificationAdapter() : new MockNotificationAdapter();

/** Constrói o conjunto de adapters com um único modo (usado nos testes). */
export function createAdapters(mode: AdapterMode): Adapters {
  return {
    crm: makeCrm(mode),
    erp: makeErp(mode),
    signature: makeSignature(mode),
    notification: makeNotification(mode),
  };
}

/** Adapters resolvidos com o modo por integração (override > global). */
export const adapters: Adapters = {
  crm: makeCrm(env.VITE_CRM_MODE ?? env.VITE_ADAPTER_MODE),
  erp: makeErp(env.VITE_ERP_MODE ?? env.VITE_ADAPTER_MODE),
  signature: makeSignature(env.VITE_SIGNATURE_MODE ?? env.VITE_ADAPTER_MODE),
  notification: makeNotification(env.VITE_NOTIFICATION_MODE ?? env.VITE_ADAPTER_MODE),
};

export * from './types';
export * from './errors';
