import { API_URL } from '../api/client';
const key = (projectId: string) => `devguardian.pending-repair:${API_URL}:${projectId}`;
export function pendingRepair(projectId: string): string {
  try { const value = sessionStorage.getItem(key(projectId)) ?? ''; return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value) ? value : ''; }
  catch { return ''; }
}
export function savePendingRepair(projectId: string, id: string): void {
  try { if (id) sessionStorage.setItem(key(projectId), id); else sessionStorage.removeItem(key(projectId)); }
  catch { /* The mounted form still prevents duplicates when storage is unavailable. */ }
}
export function clearPendingRepair(projectId: string, expectedId: string): void {
  if (expectedId && pendingRepair(projectId) === expectedId) savePendingRepair(projectId, '');
}
