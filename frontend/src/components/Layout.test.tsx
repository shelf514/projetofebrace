import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Layout } from './Layout';

function renderWithRouter(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<div>Dashboard Content</div>} />
          <Route path="historico" element={<div>History Content</div>} />
          <Route path="dispositivo" element={<div>Device Content</div>} />
          <Route path="ia" element={<div>AI Content</div>} />
          <Route path="como-funciona" element={<div>HowItWorks Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  it('exibe titulo do app', () => {
    renderWithRouter();
    expect(screen.getByText('AQUASENSE AI')).toBeInTheDocument();
  });

  it('exibe navegacao principal', () => {
    renderWithRouter();
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();
    expect(screen.getByText('Dispositivo')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.getByText('Como funciona')).toBeInTheDocument();
  });

  it('exibe aviso cientifico no rodape', () => {
    renderWithRouter();
    expect(screen.getByText(/Aviso científico/)).toBeInTheDocument();
  });

  it('exibe conteudo das paginas via Outlet', () => {
    renderWithRouter('/historico');
    expect(screen.getByText('History Content')).toBeInTheDocument();
  });
});
