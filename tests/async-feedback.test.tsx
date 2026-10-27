import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api/client';
import { useResource } from '../src/hooks/useResource';
import { useAuditRunner } from '../src/hooks/useAuditRunner';
import { AgentMonitorView } from '../src/components/AgentMonitorView';
import { RepairProgress } from '../src/components/RepairProgress';
import { ErrorNotice } from '../src/components/ui';
import { explainError } from '../src/utils/errors';
import { clearPendingRepair, pendingRepair, savePendingRepair } from '../src/utils/pendingRepair';
import { delegation, details, project, log } from './fixtures';
import type { AuditRequest } from '../src/types/contracts';

const folderMessage = 'No pudimos abrir la carpeta de este proyecto. Si era una demo anterior, puede haber caducado. Puedes preparar una nueva';
const repair: AuditRequest = { projectId: project.id, mode: 'repair', repair: { path: 'src/bug.ts', slug: 'repair', message: 'fix', unifiedDiff: '+fix', expectedFileHashes: { 'src/bug.ts': 'a'.repeat(64) }, runner: 'jest', targets: ['tests/bug.test.cjs'] } };
describe('asynchronous feedback and recovery', () => {
  it('shows updating, a completion time, and no-new-records based on real responses', async () => {
    let resolve!: (value: typeof delegation[]) => void;
    const get = vi.spyOn(api, 'delegations').mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockResolvedValue([delegation]);
    render(<AgentMonitorView projectId={project.id} />);
    const button = screen.getByRole('button', { name: 'Recargar trazas' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(button).toHaveTextContent('Actualizando...'); expect(button).toBeDisabled();
    fireEvent.click(button); expect(get).toHaveBeenCalledTimes(2);
    await act(async () => resolve([delegation]));
    await waitFor(() => expect(button).toHaveTextContent('Actualizado a las'));
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('No hay registros nuevos'));
  });
  it('translates a refresh error and allows a successful retry', async () => {
    vi.spyOn(api, 'delegations').mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Cannot initialize the workspace root.')).mockResolvedValue([delegation]);
    render(<AgentMonitorView projectId={project.id} />);
    const button = screen.getByRole('button', { name: 'Recargar trazas' });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent(`Error: ${folderMessage}`));
    expect(button).toBeEnabled(); fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Actualizado a las'));
  });
  it('coalesces repeated read refreshes before a render instead of restarting requests', async () => {
    let finish!: (value: string) => void;
    const loader = vi.fn().mockResolvedValueOnce('old').mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useResource(loader, 'scope'));
    await waitFor(() => expect(result.current.data).toBe('old'));
    act(() => { result.current.refresh(); result.current.refresh(); });
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => finish('new'));
    expect(result.current.refreshStatus).toBe('updated');
  });
  it('recovers even when a loader throws synchronously', async () => {
    const loader = vi.fn<() => Promise<string>>().mockImplementationOnce(() => { throw new Error('first failed'); }).mockResolvedValue('ok');
    const { result } = renderHook(() => useResource(loader, 'sync'));
    await waitFor(() => expect(result.current.error).toBe('first failed'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toBe('ok');
  });
  it('uses the same workspace translation for HTTP/MCP errors and UI fallbacks', () => {
    expect(new ApiError('Cannot initialize the workspace root.', 422).message).toBe(folderMessage);
    expect(explainError('Cannot initialize the workspace root.')).toBe(folderMessage);
    render(<ErrorNotice error="Cannot initialize the workspace root." />);
    expect(screen.getByRole('alert')).toHaveTextContent(folderMessage);
  });
  it('does not invent a repair step before backend evidence arrives', () => {
    render(<RepairProgress details={null} error={null} recovering={false} />);
    expect(screen.getByText(/Esperando el primer registro del backend/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('shows only the last confirmed relevant server event', () => {
    render(<RepairProgress details={{ ...details, audit: { ...details.audit, status: 'running' }, hookLogs: [
      { ...log, id: 'b', event: 'pre:run_tests', decision: 'allow', createdAt: '2026-10-27T20:00:02Z' },
      { ...log, id: 'a', event: 'pre:apply_patch', decision: 'allow', createdAt: '2026-10-27T20:00:01Z' },
    ] }} error={null} recovering={false} />);
    expect(screen.getByText('Último paso confirmado por el backend: Preparación de la ejecución de pruebas.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('keeps a repair locked after transport failure, polls its exact ID and recovers a terminal result', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const post = vi.spyOn(api, 'runAudit').mockRejectedValue(new ApiError('timeout', 0, 'TIMEOUT'));
    let finish!: () => void;
    vi.spyOn(api, 'audit').mockImplementation((id) => new Promise((resolve) => { finish = () => resolve({ ...details, audit: { ...details.audit, id, status: 'rolled_back', summaryJson: {} } }); }));
    const { result } = renderHook(() => useAuditRunner(project.id));
    await act(async () => { await expect(result.current.run(repair)).rejects.toThrow('timeout'); });
    expect(result.current.pending).toBe(true);
    expect(result.current.awaitingConfirmation).toBe(true);
    await expect(result.current.run(repair)).rejects.toThrow('Ya hay una operación');
    expect(post).toHaveBeenCalledTimes(1);
    const sent = post.mock.calls[0]?.[0];
    const id = sent?.mode === 'repair' ? sent.repair.parentSessionId : undefined;
    expect(api.audit).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    await act(async () => finish());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.details?.audit.status).toBe('rolled_back');
    expect(sessionStorage.length).toBe(0);
  });
  it('resumes monitoring after remount and never resends the repair', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const post = vi.spyOn(api, 'runAudit').mockRejectedValue(new ApiError('lost connection', 0));
    vi.spyOn(api, 'audit').mockImplementation(async (id) => ({ ...details, audit: { ...details.audit, id, status: 'running', summaryJson: {} } }));
    const first = renderHook(() => useAuditRunner(project.id));
    await act(async () => { await expect(first.result.current.run(repair)).rejects.toThrow('lost connection'); });
    first.unmount();
    const second = renderHook(() => useAuditRunner(project.id));
    expect(second.result.current.pending).toBe(true);
    await waitFor(() => expect(second.result.current.progress?.audit.status).toBe('running'));
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('does not clear a newer recovery marker when an older response arrives late', () => {
    const old = '11111111-1111-4111-8111-111111111111';
    const current = '22222222-2222-4222-8222-222222222222';
    savePendingRepair(project.id, current);
    clearPendingRepair(project.id, old);
    expect(pendingRepair(project.id)).toBe(current);
    clearPendingRepair(project.id, current);
    expect(pendingRepair(project.id)).toBe('');
  });
  it('unlocks after a definitive workspace rejection before execution', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'runAudit').mockRejectedValue(new ApiError('Cannot initialize the workspace root.', 409, 'FILE_SYSTEM_ERROR'));
    const { result } = renderHook(() => useAuditRunner(project.id));
    await act(async () => { await expect(result.current.run(repair)).rejects.toThrow(folderMessage); });
    expect(result.current.pending).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
});
