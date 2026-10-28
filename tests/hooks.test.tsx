import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { useServerHealth } from '../src/hooks/useServerHealth';
import { useProjects } from '../src/hooks/useProjects';
import { useAuditRunner } from '../src/hooks/useAuditRunner';
import { useHookGuardrails } from '../src/hooks/useHookGuardrails';
import { useSubagents } from '../src/hooks/useSubagents';
import { useMcpTools } from '../src/hooks/useMcpTools';
import { useAction, useResource } from '../src/hooks/useResource';
import { config, delegation, details, diagnosed, health, log, project, tools } from './fixtures';

describe('dedicated UI hooks', () => {
  it('useServerHealth reports connectivity and rechecks after manual refresh', async () => {
    const healthCall = vi.spyOn(api, 'health').mockResolvedValue(health);
    const { result } = renderHook(() => useServerHealth(0));
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => result.current.refresh());
    await waitFor(() => expect(healthCall).toHaveBeenCalledTimes(2));
  });
  it('useServerHealth distinguishes degraded DB from connectivity success', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({
      ...health,
      database: { ...health.database, connected: false },
    });
    const { result } = renderHook(() => useServerHealth(0));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.connected).toBe(false);
  });
  it('useProjects registers and refreshes the durable list', async () => {
    const list = vi.spyOn(api, 'projects').mockResolvedValue([project]);
    vi.spyOn(api, 'registerProject').mockResolvedValue(project);
    const { result } = renderHook(useProjects);
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    await act(async () => {
      await result.current.register({
        name: project.name,
        repoPath: project.repoPath,
        defaultBranch: 'main',
        runnerType: 'jest',
      });
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
  it('useAuditRunner returns a diagnosis, keeps its persisted state and reloads history', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([details]);
    vi.spyOn(api, 'runAudit').mockResolvedValue(diagnosed);
    const { result } = renderHook(() => useAuditRunner(project.id));
    await act(async () => {
      await result.current.run({ projectId: project.id, mode: 'diagnose', path: 'src/bug.ts' });
    });
    expect(result.current.phase).toBe('diagnosed');
    expect(result.current.details?.audit.status).toBe('blocked');
  });
  it('useAuditRunner restores a selected session from GET /api/audits/:id', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([details]);
    const get = vi.spyOn(api, 'audit').mockResolvedValue(details);
    const { result } = renderHook(() => useAuditRunner(project.id));
    await act(async () => {
      await result.current.select(details.audit.id);
    });
    expect(get).toHaveBeenCalledWith(details.audit.id);
    expect(result.current.details?.audit.id).toBe(details.audit.id);
  });
  it.each(['committed', 'rolled_back', 'blocked'] as const)(
    'useAuditRunner preserves the real terminal verdict %s',
    async (status) => {
      vi.spyOn(api, 'audits').mockResolvedValue([]);
      vi.spyOn(api, 'runAudit').mockResolvedValue({
        ...diagnosed,
        mode: 'repair',
        status,
        audit: { ...details.audit, status, summaryJson: {} },
      });
      const { result } = renderHook(() => useAuditRunner(project.id));
      await act(async () => {
        await result.current.run({ projectId: project.id, mode: 'diagnose', path: 'src/bug.ts' });
      });
      expect(result.current.phase).toBe(status);
    },
  );
  it('useHookGuardrails keeps actual BLOCK evidence instead of showing a request error', async () => {
    vi.spyOn(api, 'hookConfig').mockResolvedValue(config);
    vi.spyOn(api, 'hookLogs').mockResolvedValue([log]);
    vi.spyOn(api, 'evaluateHook').mockResolvedValue({
      ...details,
      hookLogs: [log],
      auditId: details.audit.id,
      decision: 'block',
    });
    const { result } = renderHook(() => useHookGuardrails(project.id));
    await waitFor(() => expect(result.current.data?.logs).toHaveLength(1));
    await act(async () => {
      await result.current.evaluateGuardrail(['.env'], '+demo');
    });
    expect(result.current.evaluation.data?.decision).toBe('block');
    expect(result.current.evaluation.error).toBeNull();
  });
  it('useSubagents exposes worker tools and consumption without fabricating events', async () => {
    vi.spyOn(api, 'delegations').mockResolvedValue([delegation]);
    const { result } = renderHook(() => useSubagents(project.id));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]?.consumptionStatus).toBe('diagnosis_only');
  });
  it('useMcpTools uses live tool catalog and project-scoped invocations', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(tools);
    const call = vi.spyOn(api, 'callToolRaw').mockResolvedValue({ data: { clean: true }, meta: {} });
    const { result } = renderHook(() => useMcpTools(project.id));
    await waitFor(() => expect(result.current.data).toHaveLength(19));
    await act(async () => {
      await result.current.call('git_status', {});
    });
    expect(call).toHaveBeenCalledWith('git_status', {}, project.id);
  });
  it('aborts obsolete reads and discards a late response from the previous project', async () => {
    let firstResolve!: (value: string) => void;
    const first = new Promise<string>((resolve) => {
      firstResolve = resolve;
    });
    const loaderA = vi.fn(() => first);
    const loaderB = vi.fn(async () => 'project B');
    const { result, rerender } = renderHook(
      ({ scope }) => useResource(scope === 'A' ? loaderA : loaderB, scope),
      { initialProps: { scope: 'A' } },
    );
    rerender({ scope: 'B' });
    await waitFor(() => expect(result.current.data).toBe('project B'));
    await act(async () => firstResolve('stale A'));
    expect(result.current.data).toBe('project B');
    expect(loaderA.mock.calls).toHaveLength(1);
  });
  it('prevents a concurrent duplicate mutation before React renders pending state', async () => {
    let finish!: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const { result } = renderHook(() => useAction<string>());
    let first!: Promise<string>;
    act(() => {
      first = result.current.execute(() => promise);
    });
    await expect(result.current.execute(async () => 'duplicate')).rejects.toThrow(
      'Ya hay una operación',
    );
    await act(async () => {
      finish('done');
      await first;
    });
    expect(result.current.data).toBe('done');
  });
  it('exposes network failures without retrying a mutation', async () => {
    const call = vi.spyOn(api, 'runAudit').mockRejectedValue(new Error('network failed'));
    vi.spyOn(api, 'audits').mockResolvedValue([]);
    const { result } = renderHook(() => useAuditRunner(project.id));
    await act(async () => {
      await expect(
        result.current.run({ projectId: project.id, mode: 'diagnose', path: 'src/bug.ts' }),
      ).rejects.toThrow('network failed');
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('network failed');
  });
});
