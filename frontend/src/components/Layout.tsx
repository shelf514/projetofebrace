import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/historico', label: 'Histórico', end: false },
  { to: '/dispositivo', label: 'Dispositivo', end: false },
  { to: '/ia', label: 'IA', end: false },
  { to: '/como-funciona', label: 'Como funciona', end: false },
];

export function Layout() {
  return (
    <div className="min-h-full">
      <header className="bg-sky-700 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">💧</span>
            <h1 className="text-lg font-bold tracking-tight">AQUASENSE AI</h1>
          </div>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-sky-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-sky-100">
            FEBRACE · monitoramento da qualidade da água
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-6 text-center text-xs text-slate-400">
        As previsões exibidas são saídas estatísticas do modelo de ML e não constituem certificação sanitária.
      </footer>
    </div>
  );
}
