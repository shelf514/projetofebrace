import { Suspense, lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const DevicePage = lazy(() => import('./pages/DevicePage').then((m) => ({ default: m.DevicePage })));
const AIPage = lazy(() => import('./pages/AIPage').then((m) => ({ default: m.AIPage })));
const ComoFunciona = lazy(() => import('./pages/ComoFunciona').then((m) => ({ default: m.ComoFunciona })));

function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h2 className="text-lg font-bold text-slate-800">Página não encontrada</h2>
      <p className="mt-2 text-sm text-slate-500">Verifique o endereço ou volte ao dashboard.</p>
      <a href="#/" className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
        Voltar ao início
      </a>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense
          fallback={
            <div className="mx-auto max-w-5xl space-y-4 p-6" aria-busy="true" aria-live="polite">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            </div>
          }
        >
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="historico" element={<History />} />
              <Route path="dispositivo" element={<DevicePage />} />
              <Route path="ia" element={<AIPage />} />
              <Route path="como-funciona" element={<ComoFunciona />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
