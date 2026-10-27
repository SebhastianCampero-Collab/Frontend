import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { auditLabel } from '../types/contracts';
import type { AuditDetails, AuditRequest, AuditRun } from '../types/contracts';
import { useAction, useResource } from './useResource';
import { clearPendingRepair, pendingRepair, savePendingRepair } from '../utils/pendingRepair';
/** Polls persisted sessions; a POST response is never treated as proof of a commit by itself. */
export function useAuditRunner(projectId: string, offset = 0, restoreLatest = false) {
  const loader = useCallback(
    (signal: AbortSignal) => api.audits({ projectId, limit: 20, offset }, signal),
    [projectId, offset],
  );
  const history = useResource(loader, `${projectId}:${offset}`, 5000, Boolean(projectId));
  const action = useAction<AuditRun>();
  const selection = useAction<AuditDetails>();
  const [phase, setPhase] = useState('idle');
  const [repairId, setRepairId] = useState(() => pendingRepair(projectId));
  const lock = useRef(Boolean(repairId));
  const [recovered, setRecovered] = useState<AuditDetails | null>(null);
  const loadProgress = useCallback(async (signal: AbortSignal) => {
    const data = await api.audit(repairId, signal);
    if (data.audit.id !== repairId || data.project.id !== projectId || data.audit.projectId !== projectId)
      throw new Error('La respuesta de progreso no corresponde al proyecto y al intento actuales.');
    return data;
  }, [repairId, projectId]);
  const progress = useResource(loadProgress, `${projectId}:${repairId}`, 2000, Boolean(repairId));
  useEffect(() => {
    if (repairId && progress.data && !action.pending && !['pending', 'running'].includes(progress.data.audit.status)) {
      setRecovered(progress.data); setRepairId(''); clearPendingRepair(projectId, repairId); lock.current = false;
    }
  }, [repairId, progress.data, action.pending, projectId]);
  const run = async (input: AuditRequest) => {
    if (input.projectId !== projectId) throw new Error('El proyecto de la solicitud cambió.');
    if (lock.current) throw new Error('Ya hay una operación en curso.');
    lock.current = true;
    setRecovered(null);
    const id = input.mode === 'repair' ? input.repair.parentSessionId ?? crypto.randomUUID() : '';
    const request = input.mode === 'repair' ? { ...input, repair: { ...input.repair, parentSessionId: id } } : input;
    setRepairId(id);
    if (id) savePendingRepair(projectId, id);
    selection.reset();
    setPhase('pending');
    try {
      const result = await action.execute(async () => {
        const data = await api.runAudit(request);
        if (id && (data.audit.id !== id || data.audit.projectId !== projectId)) throw new ApiError('La respuesta no corresponde al intento enviado.', 200, 'INVALID_RESPONSE');
        return data;
      });
      setPhase(
        result.status === 'blocked' && result.audit.summaryJson['outcome'] === 'diagnosed'
          ? 'diagnosed'
          : result.status,
      );
      if (!['pending', 'running'].includes(result.audit.status)) { setRepairId(''); clearPendingRepair(projectId, id); lock.current = false; }
      return result;
    } catch (error: unknown) {
      setPhase('failed');
      // A transport failure does not prove the server stopped mutating the repo.
      const definitive = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408;
      if (!id || definitive) { setRepairId(''); clearPendingRepair(projectId, id); lock.current = false; }
      throw error;
    } finally {
      history.refresh();
    }
  };
  const select = (id: string) => selection.execute(() => api.audit(id));
  const details = selection.data ?? action.data ?? recovered ?? (restoreLatest ? history.data?.[0] ?? null : null);
  return {
    history,
    run,
    select,
    details,
    phase: action.pending || repairId ? progress.data ? auditLabel(progress.data) : 'pending' : details ? auditLabel(details) : phase,
    pending: action.pending || Boolean(repairId),
    progress: repairId ? progress.data : null,
    progressError: repairId ? progress.error : null,
    awaitingConfirmation: Boolean(repairId) && !action.pending,
    repairActive: Boolean(repairId),
    refreshProgress: progress.refresh,
    progressResource: progress,
    selecting: selection.pending,
    error: recovered ? selection.error : action.error ?? selection.error,
  };
}
