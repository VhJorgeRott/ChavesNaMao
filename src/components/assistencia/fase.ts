import type { FaseChamado } from '@/adapters/types';

/** Rótulo, cor do KPI (`dot`) e cores da pill de situação por fase. */
export const FASE_META: Record<FaseChamado, { label: string; dot: string; bg: string; cor: string }> = {
  nova: { label: 'Novas', dot: '#f29f05', bg: '#f29f05', cor: '#fff' },
  andamento: { label: 'Em andamento', dot: '#3b82f6', bg: '#dbeafe', cor: '#1d4ed8' },
  improcedente: { label: 'Improcedentes', dot: '#cbd5e1', bg: '#f1f5f9', cor: '#475569' },
  finalizado: { label: 'Finalizadas', dot: '#22c55e', bg: 'rgba(34,197,94,.15)', cor: '#15803d' },
};
