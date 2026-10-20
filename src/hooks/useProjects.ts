import { useCallback } from 'react';
import { api } from '../api/client';
import type { Project, RegisterProject } from '../types/contracts';
import { useAction, useResource } from './useResource';
/** Lists durable projects and registers existing repositories within trusted backend roots. */
export function useProjects() {
  const loader = useCallback((signal: AbortSignal) => api.projects(signal), []);
  const resource = useResource(loader, 'projects', 30000);
  const action = useAction<Project>();
  const register = async (input: RegisterProject) => {
    const project = await action.execute(() => api.registerProject(input));
    resource.refresh();
    return project;
  };
  return { ...resource, register, registering: action.pending, registerError: action.error };
}
