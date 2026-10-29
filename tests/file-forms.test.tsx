import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api/client';
import { AuditPanel } from '../src/components/AuditPanel';
import { FileReader } from '../src/components/FileReader';
import { AdvancedOptions } from '../src/components/AdvancedOptions';
import { diagnosed, project, health } from './fixtures';

const files = { files: [{ path: 'src/actual.ts', analyzable: true }, { path: 'README.md', analyzable: false }], truncated: false };
const reader = <FileReader projectId={project.id} files={files} loading={false} error={null} refresh={vi.fn()} />;
describe('interactive file tools', () => {
  it.each([false, true])('uses server isolation capability (%s) for a recovered imported project', async (isolatedTests) => {
    const checkHealth = vi.spyOn(api, 'health').mockResolvedValue({ ...health, capabilities: { isolatedTests, requiresIsolation: true } });
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'projectFiles').mockResolvedValue(files);
    const run = vi.spyOn(api, 'runAudit');
    render(<AdvancedOptions.Provider value={true}><AuditPanel project={{ ...project, repoPath: '/workspace/.devguardian-imports/recovered' }} view="review" /></AdvancedOptions.Provider>);
    await waitFor(() => expect(checkHealth).toHaveBeenCalled());
    const repair = screen.getByRole('button', { name: 'Reparación verificada' });
    await waitFor(() => isolatedTests ? expect(repair).toBeEnabled() : expect(repair).toBeDisabled());
    expect(run).not.toHaveBeenCalled();
  });
  it('queries the selected real file with numeric lines and renders escaped content', async () => {
    const call = vi.spyOn(api, 'callTool').mockResolvedValue({ data: { path: 'README.md', content: '<script>bad()</script>', startLine: 2, endLine: 5, fileHash: 'a'.repeat(64), truncated: false }, meta: {} });
    render(<AdvancedOptions.Provider value={false}>{reader}</AdvancedOptions.Provider>);
    fireEvent.change(screen.getByLabelText('Archivo para consultar'), { target: { value: 'README.md' } });
    fireEvent.change(screen.getByLabelText('Desde la línea'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Hasta la línea'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar archivo' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('read_file_context', { path: 'README.md', startLine: 2, endLine: 5 }, project.id));
    expect(await screen.findByText('<script>bad()</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver solicitud técnica' })).not.toBeInTheDocument();
  });
  it('reveals a generated, read-only payload only in advanced mode', () => {
    const view = render(<AdvancedOptions.Provider value={false}>{reader}</AdvancedOptions.Provider>);
    expect(screen.queryByText('Ver solicitud técnica')).not.toBeInTheDocument();
    view.rerender(<AdvancedOptions.Provider value={true}>{reader}</AdvancedOptions.Provider>);
    fireEvent.change(screen.getByLabelText('Archivo para consultar'), { target: { value: 'src/actual.ts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver solicitud técnica' }));
    expect(JSON.parse(screen.getByLabelText('Solicitud técnica generada').textContent ?? '{}')).toEqual({ name: 'read_file_context', arguments: { projectId: project.id, path: 'src/actual.ts', startLine: 1, endLine: 80 } });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('does not send a reversed line interval', () => {
    const call = vi.spyOn(api, 'callTool'); render(reader);
    fireEvent.change(screen.getByLabelText('Archivo para consultar'), { target: { value: 'src/actual.ts' } });
    fireEvent.change(screen.getByLabelText('Desde la línea'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Hasta la línea'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar archivo' }));
    expect(call).not.toHaveBeenCalled();
  });
  it('sends exactly the selected checks through the audit contract', async () => {
    vi.spyOn(api, 'projectFiles').mockResolvedValue(files);
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue(diagnosed);
    render(<AdvancedOptions.Provider value={false}><AuditPanel project={project} initialPath="src/actual.ts" view="review" /></AdvancedOptions.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Revisar código' })).toBeEnabled());
    expect(within(screen.getByLabelText('Archivo dentro del proyecto')).queryByRole('option', { name: 'README.md' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Errores de sintaxis'));
    fireEvent.click(screen.getByLabelText('Reglas de calidad'));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar código' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith({ projectId: project.id, mode: 'diagnose', path: 'src/actual.ts', checks: ['semantic'] }));
  });
  it('prevents review with no checks or with an unavailable saved path', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const run = vi.spyOn(api, 'runAudit');
    render(<AdvancedOptions.Provider value={false}><AuditPanel project={project} initialPath="src/missing.ts" view="review" /></AdvancedOptions.Provider>);
    expect(screen.getByRole('button', { name: 'Revisar código' })).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Archivo dentro del proyecto')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Archivo dentro del proyecto'), { target: { value: 'src/bug.ts' } });
    for (const label of ['Errores de sintaxis', 'Errores de tipos', 'Reglas de calidad']) fireEvent.click(screen.getByLabelText(label));
    expect(screen.getByRole('button', { name: 'Revisar código' })).toBeDisabled(); expect(run).not.toHaveBeenCalled();
  });
  it('shows a lost-workspace error rather than invented paths', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'projectFiles').mockRejectedValue(new Error('Vuelve a importar el repositorio.'));
    render(<AdvancedOptions.Provider value={false}><AuditPanel project={project} view="review" /></AdvancedOptions.Provider>);
    await screen.findAllByText('Vuelve a importar el repositorio.');
    expect(screen.getByRole('button', { name: 'Revisar código' })).toBeDisabled();
  });
  it('offers to reclone an unavailable workspace without duplicating the project', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'projectFiles').mockRejectedValue(new ApiError('El workspace no está disponible.', 409, 'WORKSPACE_UNAVAILABLE'));
    const reclone = vi.spyOn(api, 'recloneProject').mockResolvedValue({ project, status: 'cloned', branch: 'main', headCommit: 'a'.repeat(40), files: 2 });
    const recovered = vi.fn();
    render(<AdvancedOptions.Provider value={false}><AuditPanel project={project} view="review" onWorkspaceRecovered={recovered} /></AdvancedOptions.Provider>);
    const button = await screen.findByRole('button', { name: 'Reclonar Workspace' });
    expect(screen.getByRole('button', { name: 'Revisar código' })).toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(reclone).toHaveBeenCalledWith(project.id));
    await waitFor(() => expect(recovered).toHaveBeenCalled());
    expect(screen.getByText(/Workspace restaurado en main/)).toBeInTheDocument();
  });
});
