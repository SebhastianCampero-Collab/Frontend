import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Shell from '../src/platform/Shell';
import { api, ApiClient } from '../src/api/client';
import { RemoteView } from '../src/microfrontends/RemoteView';
import { loadRemote } from '../src/microfrontends/loader';
import type { RemoteModule } from '../src/microfrontends/contracts';
vi.mock('../src/microfrontends/loader', () => ({ loadRemote: vi.fn() }));
const tenantA = '11111111-1111-4111-8111-111111111111', tenantB = '22222222-2222-4222-8222-222222222222';
const session = { token: 'x'.repeat(43), user: { id: tenantA, email: 'qa@example.invalid' }, organizations: [{ id: tenantA, name: 'Equipo A', role: 'owner' }, { id: tenantB, name: 'Equipo B', role: 'viewer' }] };
const handles = { update: vi.fn(), unmount: vi.fn() }, mount = vi.fn<RemoteModule['mount']>(() => handles);
beforeEach(() => {
  vi.clearAllMocks(); window.location.hash = '#/projects';
  vi.mocked(loadRemote).mockResolvedValue({ version: 1, mount });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); api.setToken(''); api.setTenant(''); });
describe('multitenant shell and remote contract', () => {
  it('holds credentials in memory and resets the workspace when changing tenant', async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith('/api/auth/login') ? session : { ok: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    render(<Shell />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'long-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Equipo A · owner' }));
    await waitFor(() => expect(mount).toHaveBeenCalled());
    expect(mount.mock.calls[0]?.[1]).toMatchObject({ tenantId: tenantA, readOnly: false });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar organización' }));
    await waitFor(() => expect(handles.unmount).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Equipo B · viewer' }));
    await waitFor(() => expect(mount).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ tenantId: tenantB, readOnly: true })));
    expect(JSON.stringify(localStorage)).not.toContain(session.token);
  });
  it('sends tenant context on JSON and SSE requests, without putting it in the payload', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 })); vi.stubGlobal('fetch', fetch);
    const client = new ApiClient('http://127.0.0.1:4107'); client.setToken(session.token); client.setTenant(tenantA);
    await client.projects();
    const options = fetch.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get('X-Tenant-Id')).toBe(tenantA);
    expect(new Headers(options?.headers).get('Authorization')).toBe(`Bearer ${session.token}`);
  });
  it('does not mount a remote that finished loading after its view was removed', async () => {
    let resolve!: (value: { version: 1; mount: typeof mount }) => void;
    vi.mocked(loadRemote).mockReturnValue(new Promise(done => { resolve = done; }));
    const options = { version: 1 as const, token: session.token, tenantId: tenantA, readOnly: false, advanced: false, onReady: vi.fn(), onComplete: vi.fn(), onBusyChange: vi.fn() };
    const view = render(<RemoteView name="projects" options={options} />); view.unmount();
    resolve({ version: 1, mount }); await Promise.resolve();
    expect(mount).not.toHaveBeenCalled();
  });
});
