import { useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { useResource } from './useResource';
import { interceptedFile } from '../utils/securityDashboard';
export const SECURITY_PAGE_SIZE = 20;
export function useSecurityDashboard(projectId: string, auditId: string, offset: number) {
  const loader = useCallback(async (signal: AbortSignal) => {
    const [config, logs] = await Promise.all([
      api.hookConfig(signal), api.hookLogs({ projectId, ...(auditId ? { auditId } : {}), decision: 'block', limit: SECURITY_PAGE_SIZE, offset }, signal),
    ]);
    return { config, logs };
  }, [projectId, auditId, offset]);
  const resource = useResource(loader, `${projectId}:${auditId}:${offset}`, 5000, Boolean(projectId));
  const scope = useMemo(() => ({ projectId, paths: new Map<string, string>() }), [projectId]);
  const cache = scope.paths;
  const idsKey = JSON.stringify([...new Set((resource.data?.logs ?? []).filter((log) => log.decision === 'block' && !interceptedFile(log)).map((log) => log.auditId))].sort());
  const loadTargets = useCallback(async (signal: AbortSignal): Promise<Record<string, string>> => {
    const ids = JSON.parse(idsKey) as string[];
    const result: Record<string, string> = {};
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (next < ids.length && !signal.aborted) {
        const id = ids[next++]; if (!id) continue;
        const cached = cache.get(id);
        if (cached) { result[id] = cached; continue; }
        try {
          const details = await api.audit(id, AbortSignal.any([signal, AbortSignal.timeout(5000)]));
          if (details.audit.id === id && details.project.id === projectId && details.audit.projectId === projectId) {
            result[id] = details.audit.targetFile; cache.set(id, details.audit.targetFile);
          }
        } catch { /* Keep the interception visible if target enrichment fails. */ }
      }
    }));
    while (cache.size > 200) { const first = cache.keys().next().value; if (first) cache.delete(first); else break; }
    return result;
  }, [cache, idsKey, projectId]);
  const targets = useResource(loadTargets, `${projectId}:${idsKey}`, 0, idsKey !== '[]');
  return { ...resource, targets };
}
