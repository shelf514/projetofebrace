import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renderiza rotulo, valor e unidade', () => {
    render(<StatCard label="Temperatura" value="25.7" unit="°C" />);
    expect(screen.getByText(/temperatura/i)).toBeInTheDocument();
    expect(screen.getByText('25.7')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
  });

  it('renderiza valor numerico passado como numero', () => {
    render(<StatCard label="TDS" value={238} unit="ppm" />);
    expect(screen.getByText('238')).toBeInTheDocument();
  });

  it('renderiza dica quando fornecida', () => {
    render(<StatCard label="Modelo" value="boa" hint="Confiança: 91%" />);
    expect(screen.getByText('Confiança: 91%')).toBeInTheDocument();
  });

  it('renderiza icone de informacao com tooltip quando info e fornecida', () => {
    render(<StatCard label="Turbidez" value="12.4" unit="NTU" info="Padrão: até 5 NTU" />);
    const info = screen.getByText('ⓘ');
    expect(info).toBeInTheDocument();
    expect(info).toHaveAttribute('title', 'Padrão: até 5 NTU');
  });

  it('nao renderiza icone de informacao quando info nao e fornecida', () => {
    render(<StatCard label="Temperatura" value="25.7" />);
    expect(screen.queryByText('ⓘ')).not.toBeInTheDocument();
  });
});
