import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CalendarDays, Loader2 } from 'lucide-react';
import { DataProvider } from '@/data/DataProvider';
import { CarregarPersistidos } from '@/data/CarregarPersistidos';
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
import { Chamados } from '@/pages/Chamados';
import { EntregaDetalhe } from '@/pages/EntregaDetalhe';
import { Modelos } from '@/pages/Modelos';
import { ModeloEditor } from '@/pages/ModeloEditor';
import { Admin } from '@/pages/Admin';
import { Atividade } from '@/pages/Atividade';
import { Portal } from '@/pages/Portal';
import { Perfil } from '@/pages/Perfil';
import { TermosDeUso } from '@/pages/TermosDeUso';
import { PoliticaDePrivacidade } from '@/pages/PoliticaDePrivacidade';
import { NotFound } from '@/pages/NotFound';
import { ModuloEmBreve } from '@/pages/ModuloEmBreve';
import { QualidadeProvider } from '@/qualidade/QualidadeProvider';
import { Inspecoes } from '@/pages/qualidade/Inspecoes';
import { InspecaoExecucao } from '@/pages/qualidade/InspecaoExecucao';
import { Pendencias } from '@/pages/qualidade/Pendencias';
import { ModelosFvs } from '@/pages/qualidade/ModelosFvs';
import { ModeloFvsEditor } from '@/pages/qualidade/ModeloFvsEditor';

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
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />

              {/* App interno — exige autenticação. */}
              <Route
                element={
                  <RequireAuth>
                    <CarregarPersistidos />
                    <QualidadeProvider>
                      <AppLayout />
                    </QualidadeProvider>
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
                {/* Assistência técnica */}
                <Route
                  path="/assistencia"
                  element={<Navigate to="/assistencia/chamados" replace />}
                />
                <Route path="/assistencia/chamados" element={<Chamados />} />

                {/* Qualidade */}
                <Route path="/qualidade" element={<Navigate to="/qualidade/inspecoes" replace />} />
                <Route path="/qualidade/inspecoes" element={<Inspecoes />} />
                <Route path="/qualidade/inspecoes/:id" element={<InspecaoExecucao />} />
                <Route path="/qualidade/pendencias" element={<Pendencias />} />
                <Route path="/qualidade/modelos" element={<ModelosFvs />} />
                <Route path="/qualidade/modelos/:id" element={<ModeloFvsEditor />} />
                <Route
                  path="/qualidade/agenda"
                  element={
                    <ModuloEmBreve
                      icon={CalendarDays}
                      titulo="Agenda"
                      subtitulo="Qualidade"
                      descricao="Agenda de vistorias montada a partir do planejamento das obras no Prevision."
                    />
                  }
                />

                {/* Entrega de obra */}
                <Route path="/entregas" element={<Entregas />} />
                <Route path="/entregas/:id" element={<EntregaDetalhe />} />
                <Route path="/modelos" element={<Modelos />} />
                <Route path="/modelos/novo" element={<ModeloEditor />} />
                <Route path="/modelos/:id" element={<ModeloEditor />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/atividade"
                  element={
                    <RequireAdmin>
                      <Atividade />
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
