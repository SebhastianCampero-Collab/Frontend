import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiClient, api } from '../src/api/client';
import { GitHubImport } from '../src/components/GitHubImport';
import { project, health } from './fixtures';
import type { ImportEvent, ImportReady } from '../src/types/contracts';
import App from '../src/App';

const ready: ImportReady = { project: { ...project, repoPath: '/workspace/.devguardian-imports/example' }, validation: { compatible: true, scope: 'static-analysis', entryFile: 'src/external.ts', missing: [], warnings: [] } };
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
describe('GitHub project import', () => {
  it('parses split SSE frames, keeps bearer authentication and waits for a terminal event', async () => {
    const text = ': heartbeat\n\n' + frame('progress', { phase: 'cloning', message: 'Descargando…' }) + frame('ready', ready);
    const bytes = new TextEncoder().encode(text);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetcher);
    const client = new ApiClient('https://backend'); client.setToken('session');
    const updates: ImportEvent[] = [];
    await client.importProject('https://github.com/a/b', (event) => updates.push(event), new AbortController().signal);
    expect(updates.map((event) => event.event)).toEqual(['progress', 'ready']);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer session');
  });
  it('does not report success when the connection closes without a final confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(frame('progress', { phase: 'cloning', message: 'Descargando' }), { headers: { 'Content-Type': 'text/event-stream' } })));
    await expect(new ApiClient().importProject('https://github.com/a/b', vi.fn(), new AbortController().signal)).rejects.toThrow('interrumpió');
  });
  it('lists exact missing files instead of selecting an incompatible project', async () => {
    vi.spyOn(api, 'importProject').mockImplementation(async (_url, emit) => {
      emit({ event: 'incompatible', data: { ...ready.validation, compatible: false, missing: [{ path: 'tsconfig.json', code: 'MISSING', message: 'Falta configuración TypeScript.' }] } });
    });
    const onReady = vi.fn(); render(<GitHubImport onReady={onReady} />);
    fireEvent.change(screen.getByLabelText('Enlace de GitHub'), { target: { value: 'https://github.com/a/b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar y preparar' }));
    expect(await screen.findByText('tsconfig.json')).toBeInTheDocument(); expect(onReady).not.toHaveBeenCalled();
  });
  it('selects an imported project and opens Audit with its actual source file', async () => {
    vi.spyOn(api, 'projects').mockResolvedValue([]); vi.spyOn(api, 'health').mockResolvedValue(health); vi.spyOn(api, 'audits').mockResolvedValue([]);
    vi.spyOn(api, 'importProject').mockImplementation(async (_url, emit) => { emit({ event: 'ready', data: ready }); });
    render(<App />);
    const input = await screen.findByLabelText('Enlace de GitHub');
    expect(screen.queryByText('Proyecto listo para análisis estático')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'https://github.com/a/b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar y preparar' }));
    await waitFor(() => expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/external.ts'));
    expect(screen.getByText('Proyecto listo para análisis estático')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar Demo Diagnóstico Real' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar Demo Reparación / Subagentes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reparación verificada' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    expect(screen.getByRole('button', { name: 'Reparación verificada' })).toBeDisabled();
  });
});
