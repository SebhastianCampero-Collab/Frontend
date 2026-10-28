import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { AgentMonitorView } from '../src/components/AgentMonitorView';
import { TraceTerminal } from '../src/components/TraceTerminal';
import { traceExport, traceTelemetry } from '../src/utils/traceTelemetry';
import { delegation, project } from './fixtures';
import type { Delegation } from '../src/types/contracts';

const measured: Delegation = { ...delegation, objective: 'PRIVATE_PROMPT', durationMs: 40,
  toolCallsJson: [{ callId: 'call-1', tool: 'analyze_code', status: 'completed', dispatched: true,
    startedAt: '2026-10-19T12:00:00.001Z', finishedAt: '2026-10-19T12:00:00.016Z', durationMs: 15.25,
    input: { secret: 'PRIVATE_INPUT' }, output: { source: 'PRIVATE_SOURCE' } }],
  snapshots: [{ phase: 'delegated', timestamp: '2026-10-19T12:00:00.000Z' },
    { phase: 'returned', timestamp: '2026-10-19T12:00:00.040Z' },
    { phase: 'consumed', timestamp: '2026-10-19T12:00:00.041Z', consumption: { decision: 'diagnosis_only' } }],
};
describe('professional trace telemetry', () => {
  it('orders actual timestamps and preserves measured tool and worker durations', () => {
    const events = traceTelemetry([measured]);
    expect(events.map((event) => event.kind)).toEqual(['delegated', 'tool-start', 'tool-end', 'returned', 'consumed']);
    expect(events.find((event) => event.kind === 'tool-end')).toMatchObject({ tool: 'analyze_code', durationMs: 15.25 });
    expect(events.find((event) => event.kind === 'returned')?.durationMs).toBe(40);
    render(<TraceTerminal events={events} loading={false} error={null} />);
    expect(screen.getByText('Coordinador → subagente: invocación')).toBeInTheDocument();
    expect(screen.getByText('Herramienta → subagente: resultado')).toBeInTheDocument();
  });
  it('does not fabricate tool timing from the delegation start time', () => {
    const events = traceTelemetry([delegation]);
    expect(events.find((event) => event.kind === 'tool-record')).toMatchObject({ at: null, durationMs: null });
    render(<TraceTerminal events={events} loading={false} error={null} />);
    expect(screen.getAllByText('Hora no informada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin medición informada').length).toBeGreaterThan(0);
  });
  it('keeps every recorded consumption transition and deduplicates repeated tasks', () => {
    const task = { ...measured, consumptionStatus: 'committed', snapshots: [...measured.snapshots,
      { phase: 'consumed', timestamp: '2026-10-19T12:00:00.045Z', consumption: { decision: 'committed' } }] };
    const events = traceTelemetry([task, task]);
    expect(events.filter((event) => event.kind === 'consumed').map((event) => event.status)).toEqual(['diagnosis_only', 'committed']);
    expect(events.filter((event) => event.kind === 'delegated')).toHaveLength(1);
  });
  it('does not label a denied call as an executed tool', () => {
    const events = traceTelemetry([{ ...measured, toolCallsJson: [{ tool: 'git_apply_patch', status: 'denied', dispatched: false }] }]);
    render(<TraceTerminal events={events} loading={false} error={null} />);
    expect(screen.getByText('Llamada no ejecutada')).toBeInTheDocument();
    expect(screen.queryByText('Herramienta → subagente: resultado')).not.toBeInTheDocument();
  });
  it('filters roles locally without invoking workers or requesting another backend page', async () => {
    const tasks: Delegation[] = [measured, { ...measured, taskId: 'verification-task', role: 'verification' }, { ...measured, taskId: 'safety-task', role: 'patch-safety' }];
    const get = vi.spyOn(api, 'delegations').mockResolvedValue(tasks);
    const execute = vi.spyOn(api, 'callTool');
    render(<AgentMonitorView projectId={project.id} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar traza' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Seguridad' }));
    const terminal = screen.getByRole('region', { name: 'Terminal de telemetría de subagentes' });
    expect(within(terminal).queryByText('Diagnóstico')).not.toBeInTheDocument();
    expect(within(terminal).getAllByText('Seguridad').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Seguridad' })).toHaveAttribute('aria-pressed', 'true');
    expect(get).toHaveBeenCalledTimes(1); expect(execute).not.toHaveBeenCalled();
  });
  it('exports filtered metadata and scope without tool payloads or prompts', () => {
    const events = traceTelemetry([measured]);
    const exported = traceExport(project.id, delegation.parentSessionId, 'diagnostic', 20, events, true);
    expect(exported).toMatchObject({ projectId: project.id, stale: true, filters: { role: 'diagnostic' }, scope: { kind: 'current-page', offset: 20 } });
    const json = JSON.stringify(exported);
    for (const privateValue of ['PRIVATE_PROMPT', 'PRIVATE_INPUT', 'PRIVATE_SOURCE']) expect(json).not.toContain(privateValue);
    expect(exported.events).toHaveLength(5);
  });
  it('downloads JSON only after an explicit click and revokes the object URL', async () => {
    vi.spyOn(api, 'delegations').mockResolvedValue([measured]);
    const create = vi.fn(() => 'blob:trace-test'), revoke = vi.fn();
    const OriginalURL = URL;
    class DownloadURL extends OriginalURL { static createObjectURL = create; static revokeObjectURL = revoke; }
    vi.stubGlobal('URL', DownloadURL);
    let filename = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    render(<AgentMonitorView projectId={project.id} />);
    const button = screen.getByRole('button', { name: 'Exportar traza' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(create).toHaveBeenCalledTimes(1); expect(click).toHaveBeenCalledTimes(1);
    expect(filename).toMatch(/^devguardian-trace-.*-all\.json$/u);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:trace-test'));
  });
  it('does not enable an empty export or fabricate trace events', async () => {
    vi.spyOn(api, 'delegations').mockResolvedValue([]);
    render(<AgentMonitorView projectId={project.id} />);
    await screen.findByText(/No hay delegaciones registradas/);
    expect(screen.getByRole('button', { name: 'Exportar traza' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
