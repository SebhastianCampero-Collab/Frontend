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
import { DemoPresets } from './components/DemoPresets';
import { useAction } from './hooks/useResource';
import type { DemoSetup, ImportReady } from './types/contracts';

const tabs = [
  { id: 'audit', label: 'Auditoría', icon: LayoutDashboard, number: '01' },
  { id: 'hooks', label: 'Hooks & Guardrails', icon: ShieldCheck, number: '02' },
  { id: 'agents', label: 'Subagentes', icon: Workflow, number: '03' },
  { id: 'mcp', label: 'Catálogo MCP', icon: Braces, number: '04' },
] as const;
type Tab = (typeof tabs)[number]['id'];
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
  const [tab, setTab] = useState<Tab>('audit');
  const [registering, setRegistering] = useState(false);
  const [imported, setImported] = useState<ImportReady | null>(null);
  const [revision, setRevision] = useState(0);
  const [token, setToken] = useState('');
  const [tokenSet, setTokenSet] = useState(false);
  const demo = useAction<DemoSetup>();
  const [demoMode, setDemoMode] = useState<'diagnose' | 'repair'>('diagnose');
  const visibleProjects = [...(projects.data ?? [])];
  if (imported && !visibleProjects.some((item) => item.id === imported.project.id)) visibleProjects.push(imported.project);
  if (demo.data && !visibleProjects.some((item) => item.id === demo.data?.project.id))
    visibleProjects.push(demo.data.project);
  const project =
    (imported?.project.id === selectedId ? imported.project : undefined) ??
    (demo.data?.project.id === selectedId ? demo.data.project : undefined) ??
    projects.data?.find((item) => item.id === selectedId) ??
    projects.data
      ?.filter((item) => item.name.startsWith('Demo Render '))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
    projects.data?.[0];
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
  const prepareDemo = async (mode: 'diagnose' | 'repair') => {
    const setup = await demo.execute(() => api.prepareDemo());
    setDemoMode(mode);
    selectProject(setup.project.id);
    projects.refresh();
  };
  const demoControls = (
    <DemoPresets prepare={prepareDemo} pending={demo.pending} error={demo.error} />
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <a className="brand" href="#main-content">
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
            <button
              key={item.id}
              className={tab === item.id ? 'nav-item active' : 'nav-item'}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              <small>{item.number}</small>
            </button>
          ))}
        </nav>
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
          refreshing={health.loading || projects.loading}
          onRefresh={refresh}
        />
        <main id="main-content">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span className="status-dot live" />
                DEVSECOPS / CENTRO DE CONTROL
              </div>
              <h1>
                Código bajo control.
                <br />
                <span>Reparaciones con evidencia.</span>
              </h1>
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
              <small>{API_URL}</small>
            </div>
            <div className="metric">
              <span>
                <FolderGit2 size={16} />
                PROYECTOS
              </span>
              <strong>
                {projects.data?.length ?? '—'}
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
                  disabled={!visibleProjects.length}
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
              onClick={() => setRegistering((value) => !value)}
              aria-expanded={registering}
            >
              <Plus size={16} />
              {registering ? 'Cerrar registro' : 'Registrar proyecto'}
            </button>
          </section>
          {project && (
            <div className="repo-path">
              <code>{project.repoPath}</code>
              <span>
                workspace del backend <ArrowUpRight size={12} />
              </span>
            </div>
          )}
          {(registering || (!project && !projects.loading)) && <GitHubImport onReady={(result) => {
            setImported(result); selectProject(result.project.id); projects.refresh(); setTab('audit'); setRegistering(false);
          }} />}
          {imported && imported.project.id === project?.id && <section className="panel" role="status">
            <h2>Proyecto listo para análisis estático</h2>
            <p>Seleccionamos un archivo de tu repositorio. Puedes iniciar el diagnóstico desde Auditoría.</p>
            <ul>{imported?.validation.warnings.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>
          </section>}
          {registering && (
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
          <div key={`${project?.id ?? 'none'}-${tab}-${revision}`}>
            {project ? (
              tab === 'audit' ? (
                <AuditPanel
                  project={project}
                  {...(imported?.project.id === project.id && imported.validation.entryFile ? { initialPath: imported.validation.entryFile } : {})}
                  demoControls={demoControls}
                  {...(demo.data?.project.id === project.id
                    ? { initialRepair: demo.data.repair, initialMode: demoMode }
                    : {})}
                />
              ) : tab === 'hooks' ? (
                <GuardrailsPanel projectId={project.id} />
              ) : tab === 'agents' ? (
                <AgentMonitorView projectId={project.id} />
              ) : (
                <McpPanel projectId={project.id} />
              )
            ) : (
              <section className="panel">
                {tab === 'audit' && demoControls}
                <Empty>
                  {projects.loading
                    ? 'Cargando proyectos…'
                    : 'Registra un repositorio para comenzar. El dashboard no genera registros ni resultados simulados.'}
                </Empty>
                <button className="primary" onClick={() => setRegistering(true)}>
                  Registrar primer proyecto
                </button>
              </section>
            )}
          </div>
          <details className="connection-settings">
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
          </details>
          <footer className="page-footer">
            <span>DevGuardian · Six seven</span>
            <span>Datos reales. Decisiones trazables.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
