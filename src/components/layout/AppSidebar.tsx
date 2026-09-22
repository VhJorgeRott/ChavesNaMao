import { NavLink } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Headset,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PackageCheck,
  SearchCheck,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useSession } from '@/auth/SessionProvider';
import { useData } from '@/data/DataProvider';
import { PAPEL_META } from '@chaves/domain/status';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/UserAvatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Módulo ainda sem funcionalidade — exibe o selo "Em breve". */
  emBreve?: boolean;
}

interface NavGroup {
  titulo: string;
  itens: NavItem[];
  adminOnly?: boolean;
  /**
   * Módulo em stand-by: some do menu, mas as rotas continuam no ar (acesso
   * direto pela URL) para ser religado sem retrabalho.
   */
  oculto?: boolean;
}

/** Menu organizado por módulo da plataforma de atendimento. */
const NAV_GROUPS: NavGroup[] = [
  {
    titulo: 'Geral',
    itens: [
      { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
      { to: '/unidades', label: 'Empreendimentos', icon: Building2 },
    ],
  },
  {
    titulo: 'Assistência técnica',
    itens: [{ to: '/assistencia/chamados', label: 'Chamados', icon: Headset }],
  },
  {
    titulo: 'Vistorias',
    itens: [{ to: '/vistorias', label: 'Vistoria de unidades', icon: SearchCheck, emBreve: true }],
  },
  {
    titulo: 'Qualidade',
    oculto: true,
    itens: [
      { to: '/qualidade/inspecoes', label: 'Inspeções (FVS)', icon: ClipboardCheck },
      { to: '/qualidade/pendencias', label: 'Pendências', icon: ListChecks },
      { to: '/qualidade/modelos', label: 'Modelos de FVS', icon: ClipboardList },
      { to: '/qualidade/agenda', label: 'Agenda', icon: CalendarDays, emBreve: true },
    ],
  },
  {
    titulo: 'Entrega de obra',
    itens: [
      { to: '/entregas', label: 'Entregas', icon: PackageCheck },
      { to: '/modelos', label: 'Modelos de termo', icon: FileText },
    ],
  },
  {
    titulo: 'Administração',
    adminOnly: true,
    itens: [
      { to: '/admin', label: 'Usuários', icon: Shield },
      { to: '/atividade', label: 'Atividade', icon: Activity },
    ],
  },
];

function itemClasses(isActive: boolean): string {
  return cn(
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
    isActive
      ? 'bg-[#f59229]/15 text-[#f59229]'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const { currentUser, isAdmin, setCurrentUserId } = useSession();
  const { mode, logout } = useAuth();
  const { state } = useData();

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Chaves na Mão</p>
          <p className="text-[11px] text-muted-foreground">Rottas</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.filter((g) => !g.oculto && (!g.adminOnly || isAdmin)).map((grupo, i) => (
          <div key={grupo.titulo} className="flex flex-col gap-1">
            <p
              className={cn(
                'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                i === 0 ? 'pt-2' : 'pt-4',
              )}
            >
              {grupo.titulo}
            </p>
            {grupo.itens.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => itemClasses(isActive)}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.emBreve && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Em breve
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Rodapé: usuário + (modo dev) troca de papel + sair */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-1">
          <NavLink
            to="/perfil"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1.5 transition-colors',
                isActive ? 'bg-[#f59229]/15' : 'hover:bg-sidebar-accent',
              )
            }
          >
            <UserAvatar
              nome={currentUser.nome}
              avatarUrl={currentUser.avatarUrl}
              className="h-9 w-9 text-[11px]"
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-foreground">{currentUser.nome}</p>
              <p className="truncate text-[11px] text-muted-foreground">{currentUser.email}</p>
            </div>
          </NavLink>
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={logout}>
            <LogOut className="text-muted-foreground" />
          </Button>
        </div>

        {mode === 'dev' && (
          <div className="mt-3">
            <label className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sessão (demo)
            </label>
            <Select value={currentUser.id} onValueChange={setCurrentUserId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.nome} · {PAPEL_META[u.papel].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
