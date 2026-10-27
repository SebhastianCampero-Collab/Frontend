import { useEffect, useState } from 'react';
import { API_URL } from '../api/client';
import { RelativePathSchema } from '../types/contracts';

/** Only the file path is persisted; patches, hashes and credentials stay out of storage. */
export function useAuditPath(projectId: string, suggestedPath: string) {
  const key = `devguardian.audit-path:${API_URL}:${projectId}`;
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  let saved: string | null = null;
  try { saved = localStorage.getItem(key); } catch { /* Storage can be disabled by the browser. */ }
  const fallback = saved !== null && RelativePathSchema.safeParse(saved).success ? saved : suggestedPath;
  const path = draft?.key === key ? draft.value : fallback;
  useEffect(() => {
    if (!RelativePathSchema.safeParse(path).success) return;
    try { localStorage.setItem(key, path); } catch { /* The controlled form remains usable without storage. */ }
  }, [key, path]);
  return { path, setPath: (value: string) => setDraft({ key, value }) };
}
