import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ApiSettings } from './ApiSettings';
import { useTheme } from './ThemeProvider';

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/historico', label: 'Histórico', end: false },
  { to: '/dispositivo', label: 'Dispositivo', end: false },
  { to: '/ia', label: 'IA', end: false },
  { to: '/como-funciona', label: 'Como funciona', end: false },
];

export function Layout() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-full bg-[var(--bg)] transition-colors duration-300">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950 text-white shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-lg font-bold shadow-lg shadow-sky-500/20">💧</span>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight leading-none">AQUASENSE AI</h1>
              <p className="hidden text-[10px] font-medium tracking-widest text-sky-200/70 sm:block">FEBRACE · ÁGUA</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav aria-label="Navegação principal" className="hidden flex-1 items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-sky-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-sky-200/80 backdrop-blur md:inline-flex">
              FEBRACE · qualidade da água
            </span>
            <div className="hidden sm:block">
              <ApiSettings />
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Alternar tema"
              aria-pressed={theme === 'dark'}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm backdrop-blur hover:bg-white/20 transition-colors"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white lg:hidden"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              aria-controls="menu-mobile"
            >
              <span aria-hidden="true">{mobileOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div id="menu-mobile" className="animate-fade-in border-t border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur lg:hidden">
            <nav aria-label="Navegação móvel" className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white text-slate-900' : 'text-sky-100 hover:bg-white/10'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="mt-2 border-t border-white/10 pt-3">
                <ApiSettings />
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="font-medium">Aviso científico:</span> previsões são saídas estatísticas e não constituem certificação sanitária.
        </div>
      </footer>
    </div>
  );
}
