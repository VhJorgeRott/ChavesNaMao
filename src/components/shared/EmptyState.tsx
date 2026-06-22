import type { LucideIcon } from 'lucide-react';

/** Empty state padrão (ver feedback.md): ícone hero + título + descrição + CTA. */
export function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">{titulo}</h3>
      {descricao && <p className="mb-4 max-w-md text-sm text-muted-foreground">{descricao}</p>}
      {children}
    </div>
  );
}
