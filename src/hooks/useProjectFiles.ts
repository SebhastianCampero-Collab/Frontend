import { useCallback } from 'react';
import { api } from '../api/client';
import { useResource } from './useResource';
export function useProjectFiles(projectId: string, enabled = true) {
  const loader = useCallback((signal: AbortSignal) => api.projectFiles(projectId, signal), [projectId]);
  return useResource(loader, projectId, 0, enabled);
}
