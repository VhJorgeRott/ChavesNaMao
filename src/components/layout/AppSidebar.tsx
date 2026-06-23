import { NavLink } from 'react-router-dom';
import {
  Building2,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useSession } from '@/auth/SessionProvider';
import { useData } from '@/data/DataProvider';
import { PAPEL_META } from '@/domain/status';
import { Button } from '@/components/ui/button';
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
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/unidades', label: 'Unidades', icon: Building2 },
  { to: '/entregas', label: 'Entregas', icon: PackageCheck },
  { to: '/modelos', label: 'Modelos de termo', icon: FileText },
];

const FOOTER_NAV: NavItem[] = [{ to: '/admin', label: 'Usuários', icon: Shield, adminOnly: true }];

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
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Operação
        </p>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => itemClasses(isActive)}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Administração
            </p>
            {FOOTER_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => itemClasses(isActive)}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Rodapé: usuário + (modo dev) troca de papel + sair */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {currentUser.nome
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">{currentUser.nome}</p>
            <p className="truncate text-[11px] text-muted-foreground">{currentUser.email}</p>
          </div>
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
