import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnomalyBadge, SensorStatusBadge, StatusBadge } from './Badges';

describe('StatusBadge', () => {
  it('exibe ONLINE para status online', () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('exibe OFFLINE para status offline', () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });
});

describe('AnomalyBadge', () => {
  it('exibe ANOMALIA quando verdadeiro', () => {
    render(<AnomalyBadge anomaly={true} />);
    expect(screen.getByText('ANOMALIA')).toBeInTheDocument();
  });

  it('exibe NORMAL quando falso', () => {
    render(<AnomalyBadge anomaly={false} />);
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
  });

  it('exibe SEM INFO quando nulo', () => {
    render(<AnomalyBadge anomaly={null} />);
    expect(screen.getByText('SEM INFO')).toBeInTheDocument();
  });
});

describe('SensorStatusBadge', () => {
  it('exibe OK', () => {
    render(<SensorStatusBadge status="ok" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('exibe ATENÇÃO', () => {
    render(<SensorStatusBadge status="attention" />);
    expect(screen.getByText('ATENÇÃO')).toBeInTheDocument();
  });

  it('exibe SEM DADOS', () => {
    render(<SensorStatusBadge status="sem_dados" />);
    expect(screen.getByText('SEM DADOS')).toBeInTheDocument();
  });
});
