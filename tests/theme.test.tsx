import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { applyTheme, readTheme, THEME_KEY } from '../src/hooks/useTheme';

afterEach(() => {
  delete document.documentElement.dataset['theme'];
  document.querySelector('meta[name="theme-color"]')?.remove();
});

describe('appearance preference', () => {
  it('defaults to the existing light design and exposes an accessible two-way switch', () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole('group', { name: 'Tema de apariencia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Claro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });
  it('restores the saved preference on remount', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const view = render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    view.unmount(); render(<ThemeSwitcher />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
  it('ignores unknown preferences and still switches when storage is unavailable', () => {
    localStorage.setItem(THEME_KEY, 'invalid');
    expect(readTheme()).toBe('light');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    get.mockRestore(); set.mockRestore();
  });
  it('synchronizes appearance changes from another tab without overwriting storage', () => {
    render(<ThemeSwitcher />);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent(window, new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark', storageArea: localStorage }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(set).not.toHaveBeenCalled();
    fireEvent(window, new StorageEvent('storage', { key: null, newValue: null, storageArea: localStorage }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
  it('updates the browser chrome color with the selected palette', () => {
    const meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta);
    applyTheme('dark'); expect(meta.content).toBe('#0C0F16');
    applyTheme('light'); expect(meta.content).toBe('#F9F9F9');
  });
});
