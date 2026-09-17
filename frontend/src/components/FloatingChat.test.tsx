import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FloatingChat } from './FloatingChat';

describe('FloatingChat', () => {
  it('abre e fecha o painel pelo FAB', () => {
    render(<FloatingChat />);
    const fab = screen.getByRole('button', { name: /abrir chat aquarismo/i });
    expect(fab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: /chat aquarismo/i })).not.toBeInTheDocument();

    fireEvent.click(fab);
    expect(screen.getByRole('dialog', { name: /chat aquarismo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fechar chat aquarismo/i })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /chat aquarismo/i })).not.toBeInTheDocument();
  });
});
