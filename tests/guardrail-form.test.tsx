import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { GuardrailsPanel } from '../src/components/GuardrailsPanel';
import { config, details, log, project } from './fixtures';

beforeEach(() => {
  vi.spyOn(api, 'hookConfig').mockResolvedValue(config);
  vi.spyOn(api, 'hookLogs').mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());
describe('read-only security dashboard', () => {
  it('removes examples and the manual evaluation form and never evaluates on load or refresh', async () => {
    const evaluate = vi.spyOn(api, 'evaluateHook');
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByRole('heading', { name: 'Políticas de Seguridad Activas' });
    for (const name of ['Permitido', 'Archivo protegido', 'Secreto ficticio', 'Comprobar seguridad']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contenido del parche')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar intercepciones' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar intercepciones' })).toBeEnabled());
    expect(evaluate).not.toHaveBeenCalled();
    expect(api.hookLogs).toHaveBeenCalledWith({ projectId: project.id, decision: 'block', limit: 20, offset: 0 }, expect.any(AbortSignal));
  });
  it('uses real backend limits and rule overrides instead of fictitious policies', async () => {
    vi.spyOn(api, 'hookConfig').mockResolvedValue({ ...config, maxFiles: 7, maxPatchCharacters: 350, allowedBranches: ['fix/safe-*'], rules: { 'protected-files-and-secrets': false } });
    render(<GuardrailsPanel projectId={project.id} />);
    const heading = await screen.findByRole('heading', { name: 'Bloqueo de archivos protegidos' });
    expect(within(heading.closest('article') as HTMLElement).getByText('Desactivada')).toBeInTheDocument();
    expect(screen.getByText('Hasta 7 archivos y 350 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('fix/safe-*')).toBeInTheDocument();
    expect(screen.getByText(/Los tiempos|tiempos límite pertenecen/)).toBeInTheDocument();
  });
  it('does not show enabled protection when hooks are disabled', async () => {
    vi.spyOn(api, 'hookConfig').mockResolvedValue({ ...config, enabled: false });
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByText('0 activas en la última configuración recibida');
    expect(screen.queryByText('Activa')).not.toBeInTheDocument();
    expect(screen.getByText(/hooks están deshabilitados/)).toBeInTheDocument();
  });
  it('shows only actual blocks, timestamps, filenames and reasons without duplicating log IDs', async () => {
    const blocked = { ...log, reason: 'Protected file: .env' };
    vi.spyOn(api, 'hookLogs').mockResolvedValue([blocked, blocked, { ...log, id: 'allow', decision: 'allow', reason: 'allowed operation' }]);
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByText('Protected file: .env');
    const console = screen.getByRole('region', { name: 'Consola de intercepciones bloqueadas' });
    expect(within(console).getByText('.env')).toBeInTheDocument();
    expect(within(console).getAllByRole('row')).toHaveLength(2);
    expect(within(console).queryByText('allowed operation')).not.toBeInTheDocument();
    expect(console.querySelector('time')).toHaveAttribute('datetime', log.createdAt);
  });
  it('fetches an associated audit target without claiming it identifies every affected file', async () => {
    vi.spyOn(api, 'hookLogs').mockResolvedValue([{ ...log, reason: 'Secret pattern detected in added content.' }]);
    vi.spyOn(api, 'audit').mockResolvedValue(details);
    render(<GuardrailsPanel projectId={project.id} />);
    expect(await screen.findByText('Objetivo de la auditoría: src/bug.ts')).toBeInTheDocument();
    expect(api.audit).toHaveBeenCalledWith(details.audit.id, expect.any(AbortSignal));
  });
  it('does not use a target returned for another project', async () => {
    vi.spyOn(api, 'hookLogs').mockResolvedValue([{ ...log, reason: 'Secret pattern detected in added content.' }]);
    vi.spyOn(api, 'audit').mockResolvedValue({ ...details, project: { ...project, id: '33333333-3333-4333-8333-333333333333' } });
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByText('Archivo no informado por el backend');
    expect(screen.queryByText('Objetivo de la auditoría: src/bug.ts')).not.toBeInTheDocument();
  });
  it('updates the console from backend polling without inventing interception events', async () => {
    vi.useFakeTimers();
    const get = vi.spyOn(api, 'hookLogs').mockResolvedValueOnce([]).mockResolvedValue([{ ...log, reason: 'Protected file: .env' }]);
    render(<GuardrailsPanel projectId={project.id} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText('Protected file: .env')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Protected file: .env')).toBeInTheDocument();
  });
  it('preserves visible old records with a stale warning when a refresh fails', async () => {
    vi.spyOn(api, 'hookLogs').mockResolvedValueOnce([log]).mockRejectedValue(new Error('network failed'));
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByText(log.reason);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar intercepciones' }));
    await screen.findByText(/No se pudo actualizar la configuración/);
    expect(screen.getByText(log.reason)).toBeInTheDocument();
    expect(screen.getByText(/Conexión interrumpida/)).toBeInTheDocument();
  });
});
