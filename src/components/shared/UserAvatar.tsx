import { useState } from 'react';
import { cn } from '@/lib/utils';

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

/**
 * Avatar do usuário: foto quando houver `avatarUrl` (com fallback automático em
 * erro de carregamento), senão círculo com as iniciais do nome.
 * Tamanho/fonte via className (ex.: `h-9 w-9 text-[11px]`).
 */
export function UserAvatar({
  nome,
  avatarUrl,
  className,
}: {
  nome: string;
  avatarUrl: string | null;
  className?: string;
}): React.JSX.Element {
  const [erroFoto, setErroFoto] = useState(false);

  if (avatarUrl && !erroFoto) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${nome}`}
        onError={() => setErroFoto(true)}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-foreground',
        className,
      )}
    >
      {iniciais(nome)}
    </div>
  );
}
