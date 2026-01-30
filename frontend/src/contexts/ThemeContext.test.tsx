import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

// Test component that uses the theme hook
function TestComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // Reset localStorage mock
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();

    // Reset document attribute
    document.documentElement.removeAttribute('data-theme');
  });

  it('should default to dark theme when no preference stored', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('should use stored theme from localStorage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('light');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });

  it('should toggle theme from dark to light', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');

    await user.click(screen.getByText('Toggle Theme'));

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });

  it('should toggle theme from light to dark', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('light');
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');

    await user.click(screen.getByText('Toggle Theme'));

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('should set specific theme', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Set Light'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');

    await user.click(screen.getByText('Set Dark'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('should persist theme to localStorage', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByText('Set Light'));

    expect(localStorage.setItem).toHaveBeenCalledWith('synclinqs-theme', 'light');
  });

  it('should set data-theme attribute on document', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await user.click(screen.getByText('Set Light'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});
