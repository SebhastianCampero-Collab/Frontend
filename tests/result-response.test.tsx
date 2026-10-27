import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultResponse } from '../src/components/ResultResponse';
import { AdvancedOptions } from '../src/components/AdvancedOptions';
import { resultPresentation, statusLabel } from '../src/utils/resultPresentation';
import { api } from '../src/api/client';
import { details, log } from './fixtures';
import type { AuditDetails, TestRun } from '../src/types/contracts';

const run = (runId: string, status: 'passed' | 'failed'): TestRun => ({
  runId, runner: 'jest', status, complete: true, truncated: false, durationMs: 20,
  summary: { total: 2, failed: status === 'failed' ? 1 : 0, passed: status === 'passed' ? 2 : 1, skipped: 0, todo: 0 },
  cases: [0, 1].map((index) => ({ id: String(index), path: 'tests/bug.test.cjs', name: `Case ${index}`, status: index === 0 ? status : 'passed', failureMessage: null })),
  workspaceStateHash: 'a'.repeat(64), configurationHash: 'b'.repeat(64),
});
const committed: AuditDetails = { ...details, audit: { ...details.audit, status: 'committed', branchName: 'fix/add', commitSha: 'c'.repeat(40), baselineRunId: 'before', candidateRunId: 'after', summaryJson: { mode: 'repair', result: { status: 'committed', verification: { verdict: 'ready_to_commit', baselineRunId: 'before', candidateRunId: 'after', verificationId: 'after' } } } }, testRuns: [run('before', 'failed'), run('after', 'passed')] };
describe('human-readable results', () => {
  it('describes a verified repair using the actual before/after counts and branch', () => {
    render(<ResultResponse details={committed} />);
    expect(screen.getByText('Corrección verificada y guardada')).toBeInTheDocument();
    expect(screen.getByText(/Antes: 1 prueba fallida y 1 aprobada. Después: 0 pruebas fallidas y 2 aprobadas/)).toHaveTextContent('fix/add');
    expect(screen.getByText(/Esto no implica que se haya publicado en GitHub/)).toBeInTheDocument();
  });
  it.each(['missing', 'incomplete', 'skipped', 'wrong-verification'] as const)('does not assert verification with %s evidence', (scenario) => {
    const altered = structuredClone(committed);
    if (scenario === 'missing') altered.testRuns = [];
    if (scenario === 'incomplete') altered.testRuns[1]!.complete = false;
    if (scenario === 'skipped') altered.testRuns[1]!.summary.skipped = 1;
    if (scenario === 'wrong-verification') altered.audit.summaryJson = { result: { verification: { verificationId: 'wrong' } } };
    expect(resultPresentation(altered).displayState).toBe('inconclusive');
    expect(resultPresentation(altered).text).not.toContain('La corrección fue verificada.');
  });
  it('treats historical blocked diagnosis as completed analysis and identifies omitted type checks', () => {
    const diagnosis = { ...details, audit: { ...details.audit, summaryJson: { ...details.audit.summaryJson, diagnostic: { toolCallsExecuted: [{ tool: 'analyze_code', input: { checks: ['syntax', 'lint'] } }] } } } };
    render(<AdvancedOptions.Provider value={false}><ResultResponse details={diagnosis} /></AdvancedOptions.Provider>);
    expect(screen.getByText('Análisis terminado')).toBeInTheDocument();
    expect(screen.getByText(/No se revisaron errores de tipos/)).toBeInTheDocument();
    expect(screen.queryByText('Operación bloqueada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Detalles técnicos' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar pruebas' }));
    expect(screen.getByText(/Esta operación no registró pruebas/)).toBeInTheDocument();
  });
  it('shows the actual blocking reason instead of treating a blocked operation as repaired', () => {
    render(<ResultResponse details={{ ...details, audit: { ...details.audit, summaryJson: { mode: 'repair' } }, hookLogs: [log] }} />);
    expect(screen.getByText('Operación bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/\.env está protegido/)).toBeInTheDocument();
    expect(screen.queryByText('Corrección verificada y guardada')).not.toBeInTheDocument();
  });
  it('keeps a recorded rollback separate from a policy block and does not invent a diff', () => {
    render(<ResultResponse details={{ ...details, audit: { ...details.audit, status: 'rolled_back', summaryJson: { mode: 'repair' } }, hookLogs: [log] }} />);
    expect(screen.getByText('Cambio revertido porque no superó la verificación')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver cambios realizados' }));
    expect(screen.getByText(/Se registró una reversión del intento/)).toBeInTheDocument();
  });
  it('opens persisted evidence on demand without issuing Git mutations or running tests', () => {
    const call = vi.spyOn(api, 'callTool'); const audit = vi.spyOn(api, 'runAudit');
    render(<ResultResponse details={committed} />);
    expect(screen.queryByText('Commit SHA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalles técnicos' }));
    expect(screen.getByText('Commit SHA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar pruebas' }));
    expect(screen.getByRole('heading', { name: 'Baseline vs. candidato' })).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
  it('maps internal backend states without changing their values', () => {
    expect(statusLabel('diagnosed')).toBe('Análisis terminado');
    expect(statusLabel('committed')).toBe('Corrección verificada y guardada');
    expect(statusLabel('rolled_back')).toBe('Cambio revertido porque no superó la verificación');
    expect(statusLabel('blocked')).toBe('Operación bloqueada');
    expect(details.audit.status).toBe('blocked');
  });
});
