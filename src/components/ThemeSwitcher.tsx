import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeSwitcher() {
  const { theme, selectTheme } = useTheme();
  return (
    <div className="theme-switcher" role="group" aria-label="Tema de apariencia">
      <button type="button" aria-pressed={theme === 'light'} onClick={() => selectTheme('light')} title="Usar tema claro">
        <Sun size={15} aria-hidden="true" /><span>Claro</span>
      </button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => selectTheme('dark')} title="Usar tema oscuro">
        <Moon size={15} aria-hidden="true" /><span>Oscuro</span>
      </button>
    </div>
  );
}
