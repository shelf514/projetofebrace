import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigDialog } from './ConfigDialog';

describe('ConfigDialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza dialog com titulo', () => {
    render(<ConfigDialog onClose={() => {}} />);
    expect(screen.getByText('Configurar backend')).toBeInTheDocument();
  });

  it('valida URL invalida', () => {
    render(<ConfigDialog onClose={() => {}} />);
    const input = screen.getByLabelText('URL da API');
    fireEvent.change(input, { target: { value: 'url-invalida' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByText('URL deve começar com http:// ou https://')).toBeInTheDocument();
  });

  it('salva URL valida', () => {
    const onClose = vi.fn();
    render(<ConfigDialog onClose={onClose} />);
    const input = screen.getByLabelText('URL da API');
    fireEvent.change(input, { target: { value: 'http://192.168.1.100:8000' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByText('Salvo! Reconectando…')).toBeInTheDocument();
    expect(localStorage.getItem('aquasense.api_url')).toBe('http://192.168.1.100:8000');
  });

  it('botao fechar chama onClose', () => {
    const onClose = vi.fn();
    render(<ConfigDialog onClose={onClose} />);
    fireEvent.click(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });
});
