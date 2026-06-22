import { Search, X } from 'lucide-react';

/**
 * Campo de busca padrão do app (ver formularios.md): div relative com ícone,
 * `rounded-lg`, botão de limpar. NÃO usa o <Input> puro.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
