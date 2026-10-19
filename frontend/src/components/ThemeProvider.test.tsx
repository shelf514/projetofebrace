import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeConsumer() {
  const { theme, toggle, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setTheme('dark')}>set-dark</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('tema padrao e dark (matchMedia matches=true)', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle alterna entre light e dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('setTheme define tema explicito', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('set-dark'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('persiste tema no localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('toggle'));
    expect(window.localStorage.getItem('aquasense.theme')).toBe('light');
  });
});
