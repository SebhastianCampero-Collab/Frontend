import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { AuditPanel } from '../src/components/AuditPanel';
import { CodeInspector } from '../src/components/CodeInspector';
import { details, diagnosed, project } from './fixtures';

const imported = { ...project, repoPath: '/workspace/.devguardian-imports/example' };
beforeEach(() => { vi.spyOn(api, 'audits').mockResolvedValue([]); });

describe('audit file selection', () => {
  it('remembers the edited file on remount without an import suggestion', async () => {
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue(diagnosed);
    const first = render(<AuditPanel project={imported} initialPath="src/calculator.ts" />);
    fireEvent.change(screen.getByLabelText('Archivo dentro del proyecto'), { target: { value: 'src/other.ts' } });
    first.unmount();
    render(<AuditPanel project={imported} />);
    expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/other.ts');
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar diagnóstico' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith({ projectId: imported.id, mode: 'diagnose', path: 'src/other.ts' }));
  });
  it('keeps separate files when switching project props and returning', () => {
    const second = { ...imported, id: '33333333-3333-4333-8333-333333333333' };
    const view = render(<AuditPanel project={imported} initialPath="src/calculator.ts" />);
    fireEvent.change(screen.getByLabelText('Archivo dentro del proyecto'), { target: { value: 'src/one.ts' } });
    view.rerender(<AuditPanel project={second} initialPath="src/two.ts" />);
    expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/two.ts');
    view.rerender(<AuditPanel project={imported} />);
    expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/one.ts');
  });
  it('recovers a previously diagnosed file from history rather than the latest failed path', async () => {
    vi.spyOn(api, 'audits').mockResolvedValue([
      { ...details, audit: { ...details.audit, id: '33333333-3333-4333-8333-333333333333', status: 'failed', targetFile: 'src/server/contracts.ts', summaryJson: { mode: 'diagnose', outcome: 'failed' } } },
      { ...details, audit: { ...details.audit, targetFile: 'src/calculator.ts' } },
    ]);
    render(<AuditPanel project={imported} />);
    await waitFor(() => expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/calculator.ts'));
  });
  it('leaves an unknown project blank and usable when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    render(<AuditPanel project={imported} />);
    expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Archivo dentro del proyecto'), { target: { value: 'src/app.ts' } });
    expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/app.ts');
  });
});

describe('diagnostic evidence', () => {
  it('shows a missing-file failure without falsely reporting zero findings', () => {
    render(<CodeInspector details={{ ...details, audit: { ...details.audit, status: 'failed', targetFile: 'src/server/contracts.ts', summaryJson: {
      mode: 'diagnose', outcome: 'failed', findings: [], diagnostic: { status: 'failed', output: null, reason: 'Specialist could not complete its delegated task.', toolCallsExecuted: [
        { status: 'failed', reason: 'Path or parent directory does not exist.' },
      ] },
    } } }} />);
    expect(screen.getByText('Análisis no completado')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se encontró el archivo «src/server/contracts.ts»');
    expect(screen.queryByText('0 hallazgos')).not.toBeInTheDocument();
  });
  it('reports zero findings only after a completed diagnosis', () => {
    render(<CodeInspector details={{ ...details, audit: { ...details.audit, summaryJson: { mode: 'diagnose', outcome: 'diagnosed', findings: [] } } }} />);
    expect(screen.getByText('0 hallazgos')).toBeInTheDocument();
    expect(screen.getByText(/El diagnóstico se completó sin hallazgos/)).toBeInTheDocument();
  });
  it('does not present an operation without diagnostic evidence as a clean analysis', () => {
    render(<CodeInspector details={{ ...details, audit: { ...details.audit, summaryJson: { mode: 'hook_evaluation' } } }} />);
    expect(screen.getByText('Análisis no completado')).toBeInTheDocument();
    expect(screen.queryByText('0 hallazgos')).not.toBeInTheDocument();
  });
  it('preserves a completed diagnosis when a subsequent repair stage fails', () => {
    render(<CodeInspector details={{ ...details, audit: { ...details.audit, status: 'failed', summaryJson: { mode: 'repair', result: { diagnostic: {
      analysisId: 'analysis-1', findings: details.audit.summaryJson['findings'], rootCause: 'Error de tipos', truncated: false,
    } } } } }} />);
    expect(screen.getByText('1 hallazgos')).toBeInTheDocument();
    expect(screen.getByText('Error de tipos')).toBeInTheDocument();
    expect(screen.queryByText('Análisis no completado')).not.toBeInTheDocument();
  });
  it('marks truncated output as partial, preserving available findings', () => {
    render(<CodeInspector details={{ ...details, audit: { ...details.audit, summaryJson: { mode: 'diagnose', outcome: 'diagnosed', diagnostic: {
      status: 'completed', output: { findings: details.audit.summaryJson['findings'], truncated: true },
    } } } }} />);
    expect(screen.getByText('Resultados parciales')).toBeInTheDocument();
    expect(screen.getByText('Type string is not assignable to number')).toBeInTheDocument();
  });
});
