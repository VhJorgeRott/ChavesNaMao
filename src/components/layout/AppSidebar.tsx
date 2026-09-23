import { NavLink } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Headset,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PackageCheck,
  SearchCheck,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
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

function itemClasses(isActive: boolean, collapsed: boolean): string {
  return cn(
    'flex items-center rounded-xl text-sm font-medium transition-all',
    collapsed ? 'mx-auto h-8 w-8 justify-center rounded-lg p-0' : 'w-full gap-3 px-3 py-2.5',
    isActive
      ? 'bg-[#EEEFF4] text-gray-700'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
  );
}

interface AppSidebarProps {
  onNavigate?: () => void;
  /** Modo ícone (3rem). Só no desktop — no drawer mobile a sidebar é sempre inteira. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AppSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps): React.JSX.Element {
  const { currentUser, isAdmin, setCurrentUserId } = useSession();
  const { mode, logout } = useAuth();
  const { state } = useData();

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-[13.125rem]',
      )}
    >
      {/* Logo + botão de recolher */}
      <div
        className={cn(
          'flex items-center',
          collapsed ? 'flex-col gap-2 px-2 py-4' : 'gap-2.5 px-5 py-5',
        )}
      >
        <Logo className={collapsed ? 'h-8 w-8' : 'h-9 w-9'} />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-foreground">Chaves na Mão</p>
            <p className="text-[11px] text-muted-foreground">Rottas</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-y-auto py-2',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        {NAV_GROUPS.filter((g) => !g.oculto && (!g.adminOnly || isAdmin)).map((grupo, i) => (
          <div key={grupo.titulo} className="flex flex-col gap-1">
            {collapsed ? (
              i > 0 && <div className="mx-auto my-1 h-px w-6 bg-sidebar-border" />
            ) : (
              <p
                className={cn(
                  'px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                  i === 0 ? 'pt-2' : 'pt-4',
                )}
              >
                {grupo.titulo}
              </p>
            )}
            {grupo.itens.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => itemClasses(isActive, collapsed)}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.emBreve && (
                      <span className="flex h-4 shrink-0 items-center rounded-full bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">
                        Em breve
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Recolher/expandir. Fica em linha própria: no cabeçalho ele espremia o
          wordmark a 210px. No Control o gatilho vive no header da página. */}
      {onToggleCollapse && (
        <div className={cn('pb-1', collapsed ? 'px-2' : 'px-3')}>
          <Button
            variant="ghost"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'h-8 text-muted-foreground',
              collapsed ? 'mx-auto w-8 p-0' : 'w-full justify-start gap-3 px-3',
            )}
          >
            {collapsed ? (
              <ChevronsRight />
            ) : (
              <>
                <ChevronsLeft />
                <span className="text-sm font-medium">Recolher</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Rodapé: usuário + (modo dev) troca de papel + sair */}
      <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <NavLink
            to="/perfil"
            onClick={onNavigate}
            title={collapsed ? currentUser.nome : undefined}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 items-center rounded-xl transition-colors',
                collapsed ? 'justify-center p-1' : 'flex-1 gap-2.5 px-1 py-1.5',
                isActive ? 'bg-[#EEEFF4]' : 'hover:bg-sidebar-accent',
              )
            }
          >
            <UserAvatar
              nome={currentUser.nome}
              avatarUrl={currentUser.avatarUrl}
              className={collapsed ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[11px]'}
            />
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium text-foreground">{currentUser.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">{currentUser.email}</p>
              </div>
            )}
          </NavLink>
          <Button
            variant="ghost"
            size="icon"
            className={cn('shrink-0', collapsed && 'h-8 w-8')}
            aria-label="Sair"
            onClick={logout}
          >
            <LogOut className="text-muted-foreground" />
          </Button>
        </div>

        {mode === 'dev' && !collapsed && (
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
