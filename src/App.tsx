import { useState } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Workflow,
  Braces,
  Plus,
  Activity,
  Terminal,
  KeyRound,
  FolderGit2,
  ArrowUpRight,
  History,
} from 'lucide-react';
import { api, API_URL } from './api/client';
import { useServerHealth } from './hooks/useServerHealth';
import { useProjects } from './hooks/useProjects';
import { Header } from './components/Header';
import { ProjectsPanel } from './components/ProjectsPanel';
import { GitHubImport } from './components/GitHubImport';
import { AuditPanel } from './components/AuditPanel';
import { GuardrailsPanel } from './components/GuardrailsPanel';
import { AgentMonitorView } from './components/AgentMonitorView';
import { McpPanel } from './components/McpPanel';
import { Empty, ErrorNotice } from './components/ui';
import type { ImportReady } from './types/contracts';
import { useNavigation, routes } from './hooks/useNavigation';
import { AdvancedOptions } from './components/AdvancedOptions';

const tabs = [
  { id: 'projects', label: 'Mis proyectos', icon: FolderGit2, number: '01' },
  { id: 'review', label: 'Revisar código', icon: LayoutDashboard, number: '02' },
  { id: 'results', label: 'Resultados e historial', icon: History, number: '03' },
] as const;
const advancedTabs = [
  { id: 'hooks', label: 'Hooks y guardrails', icon: ShieldCheck },
  { id: 'agents', label: 'Trazas de subagentes', icon: Workflow },
  { id: 'mcp', label: 'MCP y edición JSON', icon: Braces },
] as const;
function rememberedProject(): string {
  try {
    return localStorage.getItem('devguardian.project') ?? '';
  } catch {
    return '';
  }
}

export default function App() {
  const health = useServerHealth();
  const projects = useProjects();
  const [selectedId, setSelectedId] = useState(rememberedProject);
  const { route, navigate, advancedRoute } = useNavigation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advanced = showAdvanced || advancedRoute;
  const [registering, setRegistering] = useState(false);
  const [imported, setImported] = useState<ImportReady | null>(null);
  const [revision, setRevision] = useState(0);
  const [auditBusy, setAuditBusy] = useState(false);
  const [token, setToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const visibleProjects = (projects.data ?? []).filter((item) =>
    !item.name.startsWith('Demo Render ') && !item.repoPath.replaceAll('\\', '/').split('/').includes('.devguardian-demo'),
  );
  if (imported && !visibleProjects.some((item) => item.id === imported.project.id)) visibleProjects.push(imported.project);
  const project = visibleProjects.find((item) => item.id === selectedId) ?? visibleProjects[0];
  const selectProject = (id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem('devguardian.project', id);
    } catch {
      /* Selection remains available in memory. */
    }
  };
  const refresh = () => {
    health.refresh();
    projects.refresh();
    setRevision((value) => value + 1);
  };
  return (
    <AdvancedOptions.Provider value={advanced}><div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault(); document.getElementById('main-content')?.focus();
      }}>
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <a className="brand" href={`#${routes.projects}`}>
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          <div>
            DevGuardian<small>ENGINEERING CONTROL</small>
          </div>
        </a>
        <div className="workspace-label">
          SIX SEVEN <span>WORKSPACE</span>
        </div>
        <nav aria-label="Navegación principal">
          {tabs.map((item) => (
            <a
              key={item.id}
              href={`#${routes[item.id]}`}
              aria-disabled={auditBusy}
              onClick={(event) => { if (auditBusy) event.preventDefault(); }}
              className={route === item.id ? 'nav-item active' : 'nav-item'}
              aria-current={route === item.id ? 'page' : undefined}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              <small>{item.number}</small>
            </a>
          ))}
        </nav>
        <div className="advanced-navigation">
          <button className="ghost" disabled={auditBusy} aria-expanded={advanced} aria-controls="advanced-navigation" onClick={() => {
            setShowAdvanced(!advanced);
            if (advancedRoute) navigate('projects');
          }}>Opciones avanzadas</button>
          {advanced && <nav id="advanced-navigation" aria-label="Herramientas avanzadas">
            {advancedTabs.map((item) => <a key={item.id} className={route === item.id ? 'nav-item active' : 'nav-item'} href={`#${routes[item.id]}`} aria-disabled={auditBusy} onClick={(event) => { if (auditBusy) event.preventDefault(); }} aria-current={route === item.id ? 'page' : undefined}>
              <item.icon size={18} /><span>{item.label}</span>
            </a>)}
            <p>Incluye MCP, JSON, hashes y trazas. Los controles de seguridad permanecen activos en todos los modos.</p>
          </nav>}
        </div>
        <div className="sidebar-note">
          <Terminal size={20} />
          <strong>Verificar antes de confirmar.</strong>
          <p>Diagnóstico, pruebas y evidencia en un solo lugar.</p>
        </div>
        <div className="sidebar-footer">
          <span className={`status-dot ${health.connected ? 'live' : ''}`} />
          <div>
            {health.connected ? 'Sistema disponible' : 'Esperando al backend'}
            <small>
              v{health.data?.version ?? '—'} · {project?.runnerType ?? 'sin proyecto'}
            </small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <Header
          health={health.data}
          connected={health.connected}
          refreshing={auditBusy || health.loading || projects.loading}
          onRefresh={refresh}
        />
        <main id="main-content" tabIndex={-1}>
          <section className="page-intro"><span className="eyebrow">{advancedRoute ? 'HERRAMIENTAS TÉCNICAS' : 'TU ESPACIO DE TRABAJO'}</span><h1>{tabs.find((item) => item.id === route)?.label ?? 'Opciones avanzadas'}</h1></section>
          {route === 'projects' && <>
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="status-dot live" />
                DEVSECOPS / CENTRO DE CONTROL
              </div>
              <h2 className="hero-title">
                Código bajo control.
                <br />
                <span>Reparaciones con evidencia.</span>
              </h2>
              <p>
                Diagnostica, verifica y sigue cada decisión del sistema.
                <br className="desktop-break" />
                Del primer hallazgo al commit seguro.
              </p>
            </div>
            <div className="hero-emblem" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <ShieldCheck size={69} strokeWidth={1.15} />
              <span>VALIDATE. VERIFY. PROTECT.</span>
            </div>
          </section>
          <div className="metric-grid">
            <div className="metric">
              <span>
                <Activity size={16} />
                BACKEND
              </span>
              <strong>{health.connected ? 'Operativo' : 'No disponible'}</strong>
              <small>{advanced ? API_URL : 'Conexión con el servidor'}</small>
            </div>
            <div className="metric">
              <span>
                <FolderGit2 size={16} />
                PROYECTOS
              </span>
              <strong>
                {projects.data ? visibleProjects.length : '—'}
                <em>registrados</em>
              </strong>
              <small>Consultados desde la base de datos</small>
            </div>
            <div className="metric">
              <span>
                <ShieldCheck size={16} />
                PERSISTENCIA
              </span>
              <strong>
                {health.data
                  ? health.data.database.mode === 'postgres'
                    ? 'PostgreSQL'
                    : 'Local JSON'
                  : 'Sin verificar'}
              </strong>
              <small>
                {health.data
                  ? `${health.data.database.tables} entidades · ${Math.floor(health.data.uptimeSeconds / 60)} min de uptime`
                  : 'Esperando respuesta de health'}
              </small>
            </div>
          </div>
          </>}
          <ErrorNotice error={health.error ?? projects.error} />
          {health.data && !health.data.database.connected && (
            <ErrorNotice error="El backend responde, pero la base de datos no está disponible." />
          )}
          <section className="project-toolbar">
            <div className="project-picker">
              <FolderGit2 size={19} />
              <label>
                PROYECTO ACTIVO
                <select
                  aria-label="Proyecto activo"
                  value={project?.id ?? ''}
                  onChange={(event) => selectProject(event.target.value)}
                  disabled={auditBusy || !visibleProjects.length}
                >
                  {!visibleProjects.length && <option value="">Sin proyectos registrados</option>}
                  {visibleProjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.defaultBranch}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="ghost"
              disabled={auditBusy}
              onClick={() => { navigate('projects'); setRegistering((value) => route === 'projects' ? !value : true); }}
              aria-expanded={registering}
            >
              <Plus size={16} />
              {registering ? 'Cerrar registro' : 'Registrar proyecto'}
            </button>
          </section>
          {advanced && project && (
            <div className="repo-path">
              <code>{project.repoPath}</code>
              <span>
                workspace del backend <ArrowUpRight size={12} />
              </span>
            </div>
          )}
          {route === 'projects' && (registering || (!project && !projects.loading)) && <GitHubImport onReady={(result) => {
            setImported(result); selectProject(result.project.id); projects.refresh(); navigate('review'); setRegistering(false);
          }} />}
          {route === 'review' && imported && imported.project.id === project?.id && <section className="panel" role="status">
            <h2>Proyecto listo para análisis estático</h2>
            <p>Seleccionamos un archivo de tu repositorio. Puedes iniciar el diagnóstico desde Auditoría.</p>
            <ul>{imported?.validation.warnings.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>
          </section>}
          {route === 'projects' && registering && advanced && (
            <details><summary>Opciones avanzadas: registrar una carpeta del servidor</summary>
            <ProjectsPanel
              register={projects.register}
              pending={projects.registering}
              error={projects.registerError}
              onRegistered={(id) => {
                selectProject(id);
                setRegistering(false);
              }}
            />
            </details>
          )}
          {route === 'projects' && project && <section className="panel">
            <h2>{project.name}</h2><p>Selecciona tu proyecto y elige qué quieres hacer.</p>
            <div className="workspace-actions"><a className="primary" href={`#${routes.review}`}>Revisar código</a><a className="ghost" href={`#${routes.results}`}>Consultar resultados e historial</a></div>
          </section>}
          {route !== 'projects' && <div key={`${project?.id ?? 'none'}-${revision}`}>
            {project ? (
              route === 'review' || route === 'results' ? (
                <AuditPanel
                  project={project}
                  view={route === 'review' ? 'review' : 'results'}
                  onComplete={() => navigate('results')}
                  onBusyChange={setAuditBusy}
                  {...(imported?.project.id === project.id && imported.validation.entryFile ? { initialPath: imported.validation.entryFile } : {})}
                />
              ) : route === 'hooks' ? (
                <GuardrailsPanel projectId={project.id} />
              ) : route === 'agents' ? (
                <AgentMonitorView projectId={project.id} />
              ) : (
                <McpPanel projectId={project.id} />
              )
            ) : (
              <section className="panel">
                <Empty>
                  {projects.loading
                    ? 'Cargando proyectos…'
                    : 'Registra un repositorio para comenzar. El dashboard no genera registros ni resultados simulados.'}
                </Empty>
                <button className="primary" onClick={() => { navigate('projects'); setRegistering(true); }}>
                  Registrar primer proyecto
                </button>
              </section>
            )}
          </div>}
          {advanced && <details className="connection-settings">
            <summary>
              <KeyRound size={14} />
              Conexión y autenticación
            </summary>
            <p>
              URL de compilación: <code>{API_URL}</code>. El token opcional se conserva solo en
              memoria y nunca se incluye en el bundle ni en localStorage.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                api.setToken(token);
                setTokenSet(Boolean(token.trim()));
                setToken('');
                refresh();
              }}
            >
              <label>
                Bearer token
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Solo si tu backend lo requiere"
                />
              </label>
              <button className="ghost">Aplicar token</button>
            </form>
            <small>
              {tokenSet ? 'Token configurado para esta sesión.' : 'Sin token configurado.'} Para
              retirarlo, envía el campo vacío.
            </small>
          </details>}
          <footer className="page-footer">
            <span>DevGuardian · Six seven</span>
            <span>Datos reales. Decisiones trazables.</span>
          </footer>
        </main>
      </div>
    </div></AdvancedOptions.Provider>
  );
}
