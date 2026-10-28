import { z } from 'zod';
import { API_URL } from '../api/client';
export const Organization = z.object({ id: z.uuid(), name: z.string(), role: z.enum(['owner', 'member', 'viewer']) });
export const Session = z.object({ token: z.string().min(32), user: z.object({ id: z.uuid(), email: z.string() }), organizations: z.array(Organization) });
export type PlatformSession = z.infer<typeof Session>;
export async function authRequest(path: string, body?: unknown, token?: string): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const result: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(result);
    throw new Error(parsed.success ? parsed.data.error.message : 'No se pudo completar la solicitud.');
  }
  return result;
}
