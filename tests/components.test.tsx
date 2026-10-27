import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { api } from '../src/api/client';
import { AuditPanel } from '../src/components/AuditPanel';
import { GuardrailsPanel } from '../src/components/GuardrailsPanel';
import { AgentMonitorView } from '../src/components/AgentMonitorView';
import { McpPanel } from '../src/components/McpPanel';
import { ProjectsPanel } from '../src/components/ProjectsPanel';
import { config, delegation, details, diagnosed, health, log, project, tools } from './fixtures';

describe('dashboard views', () => {
  it('loads a server-owned demo with a fresh hash and executes the explicit repair', async () => {
    vi.spyOn(api, 'health').mockResolvedValue(health);
    vi.spyOn(api, 'projects').mockResolvedValue([project]);
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const demoProject = {
      ...project,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Demo Render real',
      defaultBranch: 'Dev',
    };
    const repair = {
      path: 'src/target-bug.ts',
      slug: 'cloud-demo-real',
      message: 'fix: demo',
      runner: 'jest' as const,
      targets: ['tests/target-bug.test.cjs'],
      expectedFileHashes: { 'src/target-bug.ts': 'b'.repeat(64) },
      unifiedDiff: 'diff --git a/src/target-bug.ts b/src/target-bug.ts\n',
    };
    vi.spyOn(api, 'prepareDemo').mockResolvedValue({ project: demoProject, repair });
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue({ ...diagnosed, project: demoProject });
    const initialView = render(<App />);
    await screen.findByText('Backend conectado');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cargar Demo Reparación / Subagentes' }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue(repair.path),
    );
    expect(screen.getByLabelText('SHA-256 esperado')).toHaveValue('b'.repeat(64));
    expect(screen.getByLabelText(/Targets de jest/)).toHaveValue('tests/target-bug.test.cjs');
    expect(screen.getByLabelText('Proyecto activo')).toHaveValue(demoProject.id);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar reparación' }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith({ projectId: demoProject.id, mode: 'repair', repair }),
    );
    initialView.unmount();
    vi.spyOn(api, 'projects').mockResolvedValue([demoProject]);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue(repair.path),
    );
  });
  it('does not label a failed diagnosis as a successful read-only diagnosis', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'runAudit').mockResolvedValue({
      ...diagnosed,
      status: 'failed',
      audit: {
        ...details.audit,
        status: 'failed',
        summaryJson: { mode: 'diagnose', outcome: 'failed' },
      },
    });
    render(<AuditPanel project={project} initialPath="src/bug.ts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar diagnóstico' }));
    await screen.findByText('Estado persistido');
    expect(
      screen.queryByText(/Diagnóstico sin autorización de reparación/),
    ).not.toBeInTheDocument();
  });
  it('shows actual backend and DB health and keeps authorization out of localStorage', async () => {
    vi.spyOn(api, 'health').mockResolvedValue(health);
    vi.spyOn(api, 'projects').mockResolvedValue([project]);
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    render(<App />);
    await screen.findByText('Backend conectado');
    expect(screen.getAllByText('Local JSON').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Proyecto activo')).toHaveValue(project.id);
    fireEvent.change(screen.getByLabelText('Bearer token'), {
      target: { value: 'test-session-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar token' }));
    expect(localStorage.getItem('test-session-token')).toBeNull();
    expect(screen.getByLabelText('Bearer token')).toHaveValue('');
    api.setToken('');
  });
  it('registers a real project-shaped payload from the UI', async () => {
    const register = vi.fn().mockResolvedValue(project);
    const registered = vi.fn();
    render(
      <ProjectsPanel register={register} onRegistered={registered} pending={false} error={null} />,
    );
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), {
      target: { value: project.name },
    });
    fireEvent.change(screen.getByLabelText('Ruta absoluta del repositorio'), {
      target: { value: project.repoPath },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar en la base de datos' }));
    await waitFor(() => expect(registered).toHaveBeenCalledWith(project.id));
    expect(register).toHaveBeenCalledWith({
      name: project.name,
      repoPath: project.repoPath,
      defaultBranch: 'Dev',
      runnerType: 'jest',
    });
  });
  it('executes diagnosis, displays AST evidence and explains persisted blocked status', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([details]);
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue(diagnosed);
    render(<AuditPanel project={project} initialPath="src/bug.ts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar diagnóstico' }));
    await screen.findByText('Type string is not assignable to number');
    expect(run).toHaveBeenCalledWith({
      projectId: project.id,
      mode: 'diagnose',
      path: 'src/bug.ts',
    });
    expect(screen.getByText(/Diagnóstico sin autorización de reparación/)).toBeInTheDocument();
  });
  it('restores audit details after unmount/reload from the durable API', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([details]);
    const audit = vi.spyOn(api, 'audit').mockResolvedValue(details);
    const first = render(<AuditPanel project={project} />);
    await screen.findByRole('button', { name: /DIAGNOSED/ });
    first.unmount();
    render(<AuditPanel project={project} />);
    fireEvent.click(await screen.findByRole('button', { name: /DIAGNOSED/ }));
    await screen.findByText('Type string is not assignable to number');
    expect(audit).toHaveBeenCalledWith(details.audit.id);
  });
  it('obtains a trusted hash and sends the explicit patch, same target and registered runner', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'callTool').mockResolvedValue({
      data: { path: 'src/server/contracts.ts', fileHash: 'a'.repeat(64) },
      meta: {},
    });
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue({
      ...diagnosed,
      mode: 'repair',
      status: 'rolled_back',
      audit: { ...details.audit, status: 'rolled_back', summaryJson: {} },
    });
    render(<AuditPanel project={project} initialPath="src/server/contracts.ts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reparación verificada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Obtener hash actual' }));
    await waitFor(() =>
      expect(screen.getByLabelText('SHA-256 esperado')).toHaveValue('a'.repeat(64)),
    );
    fireEvent.change(screen.getByLabelText(/Targets de jest/), {
      target: { value: 'tests/bug.test.cjs' },
    });
    fireEvent.change(screen.getByLabelText('Parche unified diff'), {
      target: { value: 'diff --git a/src/server/contracts.ts b/src/server/contracts.ts\n' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar reparación' }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    const request = run.mock.calls[0]?.[0];
    expect(request?.mode).toBe('repair');
    if (request?.mode === 'repair')
      expect(request.repair).toMatchObject({
        expectedFileHashes: { 'src/server/contracts.ts': 'a'.repeat(64) },
        runner: 'jest',
        targets: ['tests/bug.test.cjs'],
      });
    await screen.findAllByText('ROLLED BACK');
  });
  it('blocks malformed repair input locally before any audit mutation', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const run = vi.spyOn(api, 'runAudit');
    render(<AuditPanel project={project} initialPath="src/bug.ts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reparación verificada' }));
    fireEvent.change(screen.getByLabelText('SHA-256 esperado'), {
      target: { value: 'a'.repeat(64) },
    });
    fireEvent.change(screen.getByLabelText(/Targets de jest/), { target: { value: '../outside' } });
    fireEvent.change(screen.getByLabelText('Parche unified diff'), { target: { value: '+patch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar reparación' }));
    await screen.findByRole('alert');
    expect(run).not.toHaveBeenCalled();
  });
  it('triggers an actual guardrail call and displays BLOCK evidence', async () => {
    vi.spyOn(api, 'hookConfig').mockResolvedValue(config);
    vi.spyOn(api, 'hookLogs').mockResolvedValue([log]);
    const evaluate = vi.spyOn(api, 'evaluateHook').mockResolvedValue({
      ...details,
      hookLogs: [log],
      auditId: details.audit.id,
      decision: 'block',
    });
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar BLOCK · .env' }));
    await waitFor(() =>
      expect(evaluate).toHaveBeenCalledWith(project.id, ['.env'], '+DEMO_VALUE=blocked'),
    );
    const status = await screen.findByRole('status');
    expect(within(status).getByText('BLOCK')).toBeInTheDocument();
    expect(within(status).getByText(log.reason)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['diagnostic', 'verification', 'patch-safety'] as const)(
    'shows the %s worker, tools and consumed result when returned by the backend',
    async (role) => {
      vi.spyOn(api, 'delegations').mockResolvedValue([{ ...delegation, role }]);
      render(<AgentMonitorView projectId={project.id} />);
      await screen.findByText('worker-1');
      expect(screen.getByRole('heading', { name: role })).toBeInTheDocument();
      expect(screen.getByText('diagnosis_only')).toBeInTheDocument();
      expect(screen.getByText('analyze_code · completed')).toBeInTheDocument();
    },
  );
  it('shows a real empty state instead of random delegation events', async () => {
    vi.spyOn(api, 'delegations').mockResolvedValue([]);
    render(<AgentMonitorView projectId={project.id} />);
    await screen.findByText(/No hay delegaciones registradas/);
    expect(screen.queryByText('worker-1')).not.toBeInTheDocument();
  });
  it('lists 19 tools, invokes tools/call and displays the actual response', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(tools);
    const call = vi
      .spyOn(api, 'callTool')
      .mockResolvedValue({ data: { clean: true }, meta: { auditId: details.audit.id } });
    render(<McpPanel projectId={project.id} />);
    await screen.findByText('19 tools');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar herramienta' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('git_status', {}, project.id));
    await screen.findByText(/"clean": true/);
  });
  it('rejects non-object MCP arguments without calling the backend', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(tools);
    const call = vi.spyOn(api, 'callTool');
    render(<McpPanel projectId={project.id} />);
    await screen.findByText('19 tools');
    fireEvent.change(screen.getByLabelText('Argumentos JSON'), { target: { value: '[]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar herramienta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('objeto JSON');
    expect(call).not.toHaveBeenCalled();
  });
  it('locks the MCP tool and argument editor until the current invocation returns', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(tools);
    let finish!: (value: { data: unknown; meta: unknown }) => void;
    vi.spyOn(api, 'callTool').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<McpPanel projectId={project.id} />);
    await screen.findByText('19 tools');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar herramienta' }));
    expect(screen.getByRole('button', { name: /^analyze_code$/ })).toBeDisabled();
    expect(screen.getByLabelText('Argumentos JSON')).toBeDisabled();
    finish({ data: { clean: true }, meta: {} });
    await waitFor(() => expect(screen.getByLabelText('Argumentos JSON')).toBeEnabled());
  });
});
