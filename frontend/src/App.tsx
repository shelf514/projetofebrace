import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { AIPage } from './pages/AIPage';
import { ComoFunciona } from './pages/ComoFunciona';
import { Dashboard } from './pages/Dashboard';
import { DevicePage } from './pages/DevicePage';
import { History } from './pages/History';

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
      </HashRouter>
    </ErrorBoundary>
  );
}
