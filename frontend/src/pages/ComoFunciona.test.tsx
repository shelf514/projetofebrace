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
    expect(screen.getByText('Como o AquaSense funciona')).toBeInTheDocument();
    expect(screen.getByText('Os sensores')).toBeInTheDocument();
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
    expect(screen.getByText('Limitações (leia antes de usar)')).toBeInTheDocument();
    expect(screen.getByText(/não substituem análises laboratoriais/i)).toBeInTheDocument();
    expect(screen.getByText(/calibração periódica/i)).toBeInTheDocument();
  });
});
