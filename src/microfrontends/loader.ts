import { z } from 'zod';
import type { RemoteModule, RemoteName } from './contracts';
const Manifest = z.object({ version: z.literal(1), remotes: z.record(z.string(), z.string()) });
export async function loadRemote(name: RemoteName): Promise<RemoteModule> {
  const response = await fetch('/remotes/manifest.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('No se encontró el catálogo de microfrontends. Ejecuta el build de plataforma.');
  const manifest = Manifest.parse(await response.json());
  const entry = manifest.remotes[name];
  if (!entry) throw new Error('El módulo no está publicado.');
  const url = new URL(entry, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/remotes/') || url.search || url.hash) throw new Error('Origen de microfrontend no autorizado.');
  const remote: unknown = await import(/* @vite-ignore */ url.href);
  if (typeof remote !== 'object' || remote === null || !('version' in remote) || remote.version !== 1 || !('mount' in remote) || typeof remote.mount !== 'function')
    throw new Error('Versión del microfrontend incompatible.');
  return remote as RemoteModule;
}
