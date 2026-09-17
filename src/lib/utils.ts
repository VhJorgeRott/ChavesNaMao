import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Minúsculas e sem acentos, para busca ("Infiltração" casa com "infiltracao"). */
export { normalizar as normalizarBusca } from '../../supabase/functions/_shared/assistencia.ts';
