import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { useSession } from '@/auth/SessionProvider';
import { PAPEL, type Papel } from '@/domain/types';
import { PAPEL_META } from '@/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fDataHora } from '@/lib/format';

export function Admin(): React.JSX.Element {
  const { state, actions } = useData();
  const { currentUser } = useSession();

  function alterarPapel(userId: string, papel: Papel) {
    actions.definirPapel(userId, papel, currentUser.id);
    toast.success('Papel atualizado', { description: PAPEL_META[papel].label });
  }

  return (
    <>
      <PageHeader
        icon={Shield}
        titulo="Usuários e permissões"
        subtitulo="Atribua papéis. A checagem definitiva é sempre server-side (RLS)."
      />
      <PageContent>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Última atividade</th>
                  <th className="px-4 py-3 text-left font-medium">Papel atual</th>
                  <th className="px-4 py-3 text-right font-medium">Atribuir</th>
                </tr>
              </thead>
              <tbody>
                {state.usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {u.nome}
                        {u.id === currentUser.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                      {fDataHora(u.ultimaAtividade)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.papel === 'admin' ? 'default' : 'outline'}>
                        {PAPEL_META[u.papel].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Select
                          value={u.papel}
                          onValueChange={(v) => alterarPapel(u.id, v as Papel)}
                        >
                          <SelectTrigger className="w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPEL.map((p) => (
                              <SelectItem key={p} value={p}>
                                {PAPEL_META[p].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="mt-4 text-xs text-muted-foreground">
          <span className="font-semibold">Nota de segurança:</span> a UI esconde ações conforme o
          papel, mas a verdade está sempre no servidor — políticas de RLS garantem que só
          administradores leem/escrevem papéis.
        </p>
      </PageContent>
    </>
  );
}
