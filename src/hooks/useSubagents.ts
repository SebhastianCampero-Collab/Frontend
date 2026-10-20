import { useCallback } from 'react';
import { api } from '../api/client';
import { useResource } from './useResource';
/** Returns durable worker traces in chronological order, preserving each consumption decision. */
export function useSubagents(projectId: string, auditId = '', offset = 0) {
  const loader = useCallback(
    async (signal: AbortSignal) =>
      (
        await api.delegations(
          { projectId, ...(auditId ? { auditId } : {}), limit: 20, offset },
          signal,
        )
      ).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    [projectId, auditId, offset],
  );
  return useResource(loader, `${projectId}:${auditId}:${offset}`, 5000, Boolean(projectId));
}
