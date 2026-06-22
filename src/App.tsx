import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DataProvider } from '@/data/DataProvider';
import { SessionProvider } from '@/auth/SessionProvider';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Unidades } from '@/pages/Unidades';
import { Entregas } from '@/pages/Entregas';
import { EntregaDetalhe } from '@/pages/EntregaDetalhe';
import { Admin } from '@/pages/Admin';
import { Portal } from '@/pages/Portal';
import { NotFound } from '@/pages/NotFound';

function App(): React.JSX.Element {
  return (
    <DataProvider>
      <SessionProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <Routes>
              {/* Portal público do cliente — fora do shell autenticado. */}
              <Route path="/portal/:token" element={<Portal />} />

              {/* App interno. */}
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/unidades" element={<Unidades />} />
                <Route path="/entregas" element={<Entregas />} />
                <Route path="/entregas/:id" element={<EntregaDetalhe />} />
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
