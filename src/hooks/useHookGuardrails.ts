import { useCallback } from 'react';
import { api } from '../api/client';
import { useAction, useResource } from './useResource';
/** A 403 with decision=block is evidence, not a network failure. Preflight never applies a patch. */
export function useHookGuardrails(projectId: string, auditId = '', offset = 0) {
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [config, logs] = await Promise.all([
        api.hookConfig(signal),
        api.hookLogs({ projectId, ...(auditId ? { auditId } : {}), limit: 20, offset }, signal),
      ]);
      return { config, logs };
    },
    [projectId, auditId, offset],
  );
  const resource = useResource(
    loader,
    `${projectId}:${auditId}:${offset}`,
    5000,
    Boolean(projectId),
  );
  const evaluation = useAction<Awaited<ReturnType<typeof api.evaluateHook>>>();
  const evaluateGuardrail = async (files: string[], unifiedDiff: string) => {
    try {
      return await evaluation.execute(() => api.evaluateHook(projectId, files, unifiedDiff));
    } finally {
      resource.refresh();
    }
  };
  return { ...resource, evaluation, evaluateGuardrail };
}
