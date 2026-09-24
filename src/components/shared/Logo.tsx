import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Marca do app. Fonte única do caminho do asset — ver docs/design-system/marca.md.
 * O PNG tem fundo transparente, então NÃO colocar dentro de um quadrado colorido.
 */
export function Logo({ className }: { className?: string }): React.JSX.Element {
  return (
    <img
      src="/logo-chaves-na-mao.png"
      alt="Chaves na Mão"
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
