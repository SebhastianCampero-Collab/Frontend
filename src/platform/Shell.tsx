import { useCallback, useState } from 'react';
import { z } from 'zod';
import { api } from '../api/client';
import { useProjects } from '../hooks/useProjects';
import { useNavigation } from '../hooks/useNavigation';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { RemoteView } from '../microfrontends/RemoteView';
import type { RemoteName, RemoteProps } from '../microfrontends/contracts';
import { authRequest, Organization, Session } from './session';
import type { PlatformSession } from './session';
import type { ImportReady } from '../types/contracts';
import './shell.css';

const navigation = [ ['projects', 'Mis proyectos'], ['review', 'Revisar código'], ['results', 'Resultados e historial'], ['hooks', 'Seguridad'], ['agents', 'Subagentes'], ['mcp', 'Sandbox MCP'] ] as const;
const remoteFor = { projects: 'projects', review: 'review', results: 'results', hooks: 'security', agents: 'subagents', mcp: 'mcp' } as const satisfies Record<string, RemoteName>;

function Workspace({ session, organization, logout, switchTenant }: { session: PlatformSession; organization: z.infer<typeof Organization>; logout: () => Promise<void>; switchTenant: () => void }) {
  const projects = useProjects(), { route, navigate } = useNavigation();
  const [selectedId, setSelectedId] = useState(''), [busy, setBusy] = useState(false), [advanced, setAdvanced] = useState(false);
  const [imported, setImported] = useState<ImportReady | null>(null);
  const visible = [...(projects.data ?? [])];
  if (imported && !visible.some(item => item.id === imported.project.id)) visible.push(imported.project);
  const project = visible.find(item => item.id === selectedId) ?? visible[0];
  const onComplete = useCallback(() => navigate('results'), [navigate]);
  const onReady = useCallback((ready: ImportReady) => { setImported(ready); setSelectedId(ready.project.id); navigate('review'); }, [navigate]);
  const props: RemoteProps = { version: 1, token: session.token, tenantId: organization.id, readOnly: organization.role === 'viewer', advanced,
    ...(project ? { project } : {}), onReady, onComplete, onBusyChange: setBusy };
  return <div className="app-shell platform-shell"><aside className="sidebar"><a className="brand" href="#/projects">DevGuardian</a><p>{organization.name}</p><small>{organization.role}</small>
    <nav aria-label="Navegación principal">{navigation.filter(([id]) => advanced || !['hooks', 'agents', 'mcp'].includes(id)).map(([id, label]) => <button key={id} disabled={busy} aria-current={route === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</button>)}</nav>
    <label><input type="checkbox" checked={advanced} disabled={busy} onChange={event => setAdvanced(event.target.checked)} />Opciones avanzadas</label>
    <button className="ghost" disabled={busy} onClick={switchTenant}>Cambiar organización</button><button className="ghost" disabled={busy} onClick={() => void logout()}>Cerrar sesión</button>
  </aside><main className="platform-main"><header><h1>{navigation.find(([id]) => id === route)?.[1]}</h1><ThemeSwitcher /></header>
    <label>Proyecto activo<select aria-label="Proyecto activo" value={project?.id ?? ''} disabled={busy} onChange={event => setSelectedId(event.target.value)}>{!visible.length && <option value="">Sin proyectos</option>}{visible.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {projects.error && <p role="alert">{projects.error}</p>}
    {organization.role === 'viewer' && <p role="status">Acceso de consulta. El servidor bloquea las operaciones de escritura.</p>}
    <RemoteView name={remoteFor[route]} options={props} />
  </main></div>;
}

export default function Shell() {
  const [session, setSession] = useState<PlatformSession | null>(null), [tenant, setTenant] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [organizationName, setOrganizationName] = useState('');
  const selected = session?.organizations.find(item => item.id === tenant);
  async function logout() {
    setPending(true); setError('');
    try { if (session) await authRequest('/api/auth/logout', {}, session.token); api.setToken(''); api.setTenant(''); setSession(null); setTenant(''); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'No se pudo cerrar sesión.'); }
    finally { setPending(false); }
  }
  if (session && selected) return <><Workspace key={tenant} session={session} organization={selected} logout={logout} switchTenant={() => { api.setTenant(''); setTenant(''); }} />{error && <p role="alert">{error}</p>}</>;
  return <main className="platform-auth panel"><ThemeSwitcher /><h1>DevGuardian</h1><p>{session ? 'Selecciona tu organización. Los proyectos y resultados están aislados por equipo.' : 'Accede al espacio de trabajo de tu equipo.'}</p>
    {error && <p role="alert">{error}</p>}
    {!session ? <form onSubmit={event => {
      event.preventDefault(); if (pending) return; setPending(true); setError('');
      void authRequest('/api/auth/login', { email, password }).then(value => { const next = Session.parse(value); api.setToken(next.token); setSession(next); setPassword(''); })
        .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'No se pudo iniciar sesión.')).finally(() => setPending(false));
    }}><label>Email<input type="email" required autoComplete="username" value={email} disabled={pending} onChange={event => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" minLength={12} required autoComplete="current-password" value={password} disabled={pending} onChange={event => setPassword(event.target.value)} /></label><button className="primary" disabled={pending}>{pending ? 'Accediendo…' : 'Iniciar sesión'}</button></form> : <>
      <div>{session.organizations.map(item => <button key={item.id} className="ghost" disabled={pending} onClick={() => { api.setTenant(item.id); setTenant(item.id); }}>{item.name} · {item.role}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); if (pending) return; setPending(true); setError(''); void authRequest('/api/organizations', { name: organizationName }, session.token).then(value => { const item = Organization.parse(value); setSession({ ...session, organizations: [...session.organizations, item] }); setOrganizationName(''); }).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'No se pudo crear la organización.')).finally(() => setPending(false)); }}><label>Nueva organización<input required maxLength={120} value={organizationName} disabled={pending} onChange={event => setOrganizationName(event.target.value)} /></label><button disabled={pending}>Crear organización</button></form>
      <button disabled={pending} onClick={() => void logout()}>Cerrar sesión</button>
    </>}
    <small>La sesión se mantiene solo en memoria; al recargar tendrás que iniciar sesión de nuevo.</small>
  </main>;
}
