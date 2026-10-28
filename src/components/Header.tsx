import { Database, RefreshCw, Radio } from 'lucide-react';
import type { Health } from '../types/contracts';
import { ThemeSwitcher } from './ThemeSwitcher';
export function Header({
  health,
  connected,
  refreshing,
  onRefresh,
}: {
  health: Health | null;
  connected: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        WORKSPACE <span>/</span> DevGuardian <span>/</span> <strong>Control de operaciones</strong>
      </div>
      <div className="header-actions">
        <ThemeSwitcher />
        <span className={`connection ${connected ? 'online' : ''}`}>
          <Radio size={14} />
          {connected ? 'Backend conectado' : 'Sin conexión'}
        </span>
        <span className="database">
          <Database size={14} />
          {health
            ? health.database.mode === 'postgres'
              ? 'PostgreSQL'
              : 'Local JSON'
            : 'BD sin verificar'}
        </span>
        <button
          className="icon-button"
          aria-label="Recargar desde la base de datos"
          title="Recargar desde la base de datos"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
    </header>
  );
}
