import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AIPage } from './pages/AIPage';
import { ComoFunciona } from './pages/ComoFunciona';
import { Dashboard } from './pages/Dashboard';
import { DevicePage } from './pages/DevicePage';
import { History } from './pages/History';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="historico" element={<History />} />
          <Route path="dispositivo" element={<DevicePage />} />
          <Route path="ia" element={<AIPage />} />
          <Route path="como-funciona" element={<ComoFunciona />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
