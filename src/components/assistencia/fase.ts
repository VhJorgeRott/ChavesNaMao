import type { FaseChamado } from '@/adapters/types';

export const FASE_META: Record<FaseChamado, { label: string; classe: string }> = {
  nova: { label: 'Novas', classe: 'border-transparent bg-primary text-primary-foreground' },
  andamento: { label: 'Em andamento', classe: 'border-transparent bg-sky-100 text-sky-800' },
  improcedente: {
    label: 'Improcedentes',
    classe: 'border-transparent bg-muted text-muted-foreground',
  },
  finalizado: {
    label: 'Finalizadas',
    classe: 'border-transparent bg-success text-success-foreground',
  },
};
