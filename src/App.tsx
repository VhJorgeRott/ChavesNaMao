import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DataProvider } from '@/data/DataProvider';
import { SessionProvider } from '@/auth/SessionProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/Login';
import { AuthCallback } from '@/pages/AuthCallback';
import { Unidades } from '@/pages/Unidades';
import { EmpreendimentoUnidades } from '@/pages/EmpreendimentoUnidades';
import { Entregas } from '@/pages/Entregas';
import { EntregaDetalhe } from '@/pages/EntregaDetalhe';
import { Modelos } from '@/pages/Modelos';
import { ModeloEditor } from '@/pages/ModeloEditor';
import { Admin } from '@/pages/Admin';
import { Portal } from '@/pages/Portal';
import { NotFound } from '@/pages/NotFound';

// Lazy: a Início carrega Recharts — mantém-no fora do bundle do login/portal.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));

function PageFallback(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <DataProvider>
      <SessionProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <Routes>
              {/* Públicas — fora do shell autenticado. */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/portal/:token" element={<Portal />} />

              {/* App interno — exige autenticação. */}
              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <Dashboard />
                    </Suspense>
                  }
                />
                <Route path="/unidades" element={<Unidades />} />
                <Route path="/unidades/:empreendimentoId" element={<EmpreendimentoUnidades />} />
                <Route path="/entregas" element={<Entregas />} />
                <Route path="/entregas/:id" element={<EntregaDetalhe />} />
                <Route path="/modelos" element={<Modelos />} />
                <Route path="/modelos/novo" element={<ModeloEditor />} />
                <Route path="/modelos/:id" element={<ModeloEditor />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </SessionProvider>
    </DataProvider>
  );
}

export default App;
