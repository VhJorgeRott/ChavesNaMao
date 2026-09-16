import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Placeholder dos módulos já presentes no menu mas ainda sem funcionalidade.
 * Mantém a navegação estável enquanto cada módulo é construído.
 */
export function ModuloEmBreve({
  icon,
  titulo,
  subtitulo,
  descricao,
}: {
  icon: LucideIcon;
  titulo: string;
  subtitulo: string;
  descricao: string;
}): React.JSX.Element {
  return (
    <>
      <PageHeader icon={icon} titulo={titulo} subtitulo={subtitulo} />
      <PageContent>
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={Construction} titulo="Módulo em construção" descricao={descricao} />
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
