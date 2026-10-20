import { useCallback, useState } from 'react';
import { api } from '../api/client';
import { auditLabel } from '../types/contracts';
import type { AuditDetails, AuditRequest, AuditRun } from '../types/contracts';
import { useAction, useResource } from './useResource';
/** Polls persisted sessions; a POST response is never treated as proof of a commit by itself. */
export function useAuditRunner(projectId: string, offset = 0) {
  const loader = useCallback(
    (signal: AbortSignal) => api.audits({ projectId, limit: 20, offset }, signal),
    [projectId, offset],
  );
  const history = useResource(loader, `${projectId}:${offset}`, 5000, Boolean(projectId));
  const action = useAction<AuditRun>();
  const selection = useAction<AuditDetails>();
  const [phase, setPhase] = useState('idle');
  const run = async (input: AuditRequest) => {
    if (input.projectId !== projectId) throw new Error('El proyecto de la solicitud cambió.');
    selection.reset();
    setPhase('pending');
    try {
      const result = await action.execute(async () => {
        setPhase('running');
        return api.runAudit(input);
      });
      setPhase(
        result.status === 'blocked' && result.audit.summaryJson['outcome'] === 'diagnosed'
          ? 'diagnosed'
          : result.status,
      );
      return result;
    } catch (error: unknown) {
      setPhase('failed');
      throw error;
    } finally {
      history.refresh();
    }
  };
  const select = (id: string) => selection.execute(() => api.audit(id));
  const details = selection.data ?? action.data;
  return {
    history,
    run,
    select,
    details,
    phase: action.pending ? phase : details ? auditLabel(details) : phase,
    pending: action.pending,
    selecting: selection.pending,
    error: action.error ?? selection.error,
  };
}
