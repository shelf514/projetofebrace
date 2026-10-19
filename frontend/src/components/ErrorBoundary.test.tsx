import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Erro de teste');
  return <div>Conteudo ok</div>;
}

describe('ErrorBoundary', () => {
  it('renderiza filhos quando nao ha erro', () => {
    render(
      <ErrorBoundary>
        <div>Conteudo ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Conteudo ok')).toBeInTheDocument();
  });

  it('captura erro e exibe mensagem', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Ocorreu um erro')).toBeInTheDocument();
    expect(screen.getByText('Erro de teste')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('botao tentar novamente reseta o estado', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>,
    );
    const button = screen.getByText('Tentar novamente');
    button.click();
    rerender(
      <ErrorBoundary>
        <Thrower shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Ocorreu um erro')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
