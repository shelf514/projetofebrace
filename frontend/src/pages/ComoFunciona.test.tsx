import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ComoFunciona } from './ComoFunciona';

describe('ComoFunciona', () => {
  it('explica o fluxo completo do sistema', () => {
    render(
      <MemoryRouter>
        <ComoFunciona />
      </MemoryRouter>,
    );
    expect(screen.getByText('Como funciona')).toBeInTheDocument();
    expect(screen.getByText('Sensores')).toBeInTheDocument();
    expect(screen.getByText('O caminho de cada leitura')).toBeInTheDocument();
    expect(screen.getByText(/DS18B20/)).toBeInTheDocument();
    expect(screen.getByText(/Isolation Forest/)).toBeInTheDocument();
    expect(screen.getByText(/Random Forest/)).toBeInTheDocument();
  });

  it('apresenta as limitacoes de forma honesta', () => {
    render(
      <MemoryRouter>
        <ComoFunciona />
      </MemoryRouter>,
    );
    expect(screen.getByText('Limitações')).toBeInTheDocument();
    expect(screen.getByText(/não certificam potabilidade/i)).toBeInTheDocument();
    expect(screen.getByText(/precisam calibração/i)).toBeInTheDocument();
  });
});
