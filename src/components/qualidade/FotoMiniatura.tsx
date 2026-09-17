import { useEffect, useState } from 'react';
import { ImageOff, Loader2, X } from 'lucide-react';
import { useQualidade } from '@/qualidade/QualidadeProvider';
import { cn } from '@/lib/utils';

/** Miniatura de foto da inspeção: usa o arquivo local; senão, URL assinada (online). */
export function FotoMiniatura({
  fotoId,
  storagePath,
  onRemover,
  className,
}: {
  fotoId: string;
  storagePath: string | null;
  onRemover?: () => void;
  className?: string;
}): React.JSX.Element {
  const { urlFoto } = useQualidade();
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    let criada: string | null = null;
    setCarregando(true);
    void urlFoto(fotoId, storagePath ?? '')
      .then((u) => {
        if (!ativo) {
          if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
          return;
        }
        if (u?.startsWith('blob:')) criada = u;
        setUrl(u);
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [fotoId, storagePath, urlFoto]);

  return (
    <div
      className={cn(
        'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted',
        className,
      )}
    >
      {carregando ? (
        <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-muted-foreground" />
      ) : url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Foto da inspeção" className="h-full w-full object-cover" />
        </a>
      ) : (
        <ImageOff
          className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground"
          aria-label="Foto indisponível offline"
        />
      )}
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover foto"
          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
