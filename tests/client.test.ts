import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api/client';
import { auditLabel, RepairSchema } from '../src/types/contracts';
import { details, health, log, project, reply, tools } from './fixtures';

describe('HTTP and MCP contracts', () => {
  const fetcher = vi.fn<typeof fetch>();
  let client: ApiClient;
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubGlobal('fetch', fetcher);
    client = new ApiClient('http://backend');
  });
  it('uses exact projects route and unwraps its array', async () => {
    fetcher.mockResolvedValue(reply([project]));
    expect(await client.projects()).toEqual([project]);
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://backend/api/projects');
  });
  it('prepares a cloud demo without accepting filesystem paths from the browser', async () => {
    const setup = {
      project,
      repair: {
        path: 'src/target-bug.ts',
        slug: 'cloud-demo',
        message: 'fix: demo',
        runner: 'jest',
        targets: ['tests/target-bug.test.cjs'],
        expectedFileHashes: { 'src/target-bug.ts': 'a'.repeat(64) },
        unifiedDiff: '+demo',
      },
    };
    fetcher.mockResolvedValue(reply(setup, 201));
    expect(await client.prepareDemo()).toEqual(setup);
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://backend/api/demo/prepare');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({});
  });
  it('registers projects with a typed body and bearer held only in memory', async () => {
    client.setToken('test-session');
    fetcher.mockResolvedValue(reply(project, 201));
    const input = {
      name: project.name,
      repoPath: project.repoPath,
      defaultBranch: project.defaultBranch,
      runnerType: project.runnerType,
    };
    await client.registerProject(input);
    const options = fetcher.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer test-session');
    expect(JSON.parse(String(options?.body))).toEqual(input);
    expect(localStorage.length).toBe(0);
  });
  it('preserves blocked guardrail evidence from HTTP 403', async () => {
    fetcher.mockResolvedValue(
      reply(
        { ...details, hookLogs: [log], auditId: details.audit.id, decision: 'block' },
        403,
        false,
      ),
    );
    const result = await client.evaluateHook(project.id, ['.env'], '+demo');
    expect(result.decision).toBe('block');
    expect(result.hookLogs[0]?.reason).toBe(log.reason);
  });
  it('retains degraded health on 503', async () => {
    fetcher.mockResolvedValue(
      reply(
        { ...health, status: 'degraded', database: { ...health.database, connected: false } },
        503,
        false,
      ),
    );
    expect((await client.health()).database.connected).toBe(false);
  });
  it('supports both public health paths', async () => {
    fetcher.mockImplementation(async () => reply(health));
    await client.health(undefined, '/health');
    await client.health();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend/health',
      'http://backend/api/health',
    ]);
  });
  it('rejects malformed successful responses', async () => {
    fetcher.mockResolvedValue(reply({ projects: [] }));
    await expect(client.projects()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects HTML fallback responses', async () => {
    fetcher.mockResolvedValue(new Response('<html>Not found</html>', { status: 404 }));
    await expect(client.projects()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('keeps HTTP authentication errors distinct from guardrail decisions', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Authentication required.' },
        }),
        { status: 401 },
      ),
    );
    await expect(client.projects()).rejects.toMatchObject({
      status: 401,
      message: 'Authentication required.',
    });
  });
  it('encodes audit filters and pagination', async () => {
    fetcher.mockResolvedValue(reply([]));
    await client.audits({ projectId: project.id, limit: 20, offset: 20 });
    const url = String(fetcher.mock.calls[0]?.[0]);
    expect(url).toContain(`projectId=${project.id}`);
    expect(url).toContain('offset=20');
  });
  it('negotiates MCP and lists all 19 tools', async () => {
    fetcher.mockImplementation(async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      return body.method === 'notifications/initialized'
        ? new Response(null, { status: 202 })
        : new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: body.method === 'tools/list' ? { tools } : { protocolVersion: '2025-11-25' },
            }),
          );
    });
    expect(await client.listTools()).toHaveLength(19);
    expect(fetcher.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
  });
  it('injects selected project into tools/call, overriding foreign project arguments', async () => {
    fetcher.mockImplementation(async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      expect(body.params.arguments.projectId).toBe(project.id);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            structuredContent: { ok: true, data: { clean: true } },
            _meta: { auditId: details.audit.id },
          },
        }),
      );
    });
    expect(
      (await client.callTool('git_status', { projectId: 'foreign' }, project.id)).data,
    ).toEqual({ clean: true });
  });
  it('rejects domain failures and carries the audited evidence ID', async () => {
    fetcher.mockImplementation(
      async (_url, options) =>
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: JSON.parse(String(options?.body)).id,
            result: {
              structuredContent: {
                ok: false,
                error: { code: 'PATH_PROTECTED', message: 'Blocked' },
              },
              isError: true,
              _meta: { auditId: details.audit.id },
            },
          }),
        ),
    );
    await expect(
      client.callTool('read_file_context', { path: '.env' }, project.id),
    ).rejects.toMatchObject({ code: 'PATH_PROTECTED', requestId: details.audit.id });
  });
  it('rejects mismatched JSON-RPC response IDs', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 999, result: {} })),
    );
    await expect(client.rpc('tools/list', {})).rejects.toMatchObject({ code: 'MCP_ERROR' });
  });
  it('accepts the MCP textual result fallback', async () => {
    fetcher.mockImplementation(
      async (_url, options) =>
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: JSON.parse(String(options?.body)).id,
            result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, data: 42 }) }] },
          }),
        ),
    );
    expect((await client.callTool('git_status', {}, project.id)).data).toBe(42);
  });
  it('does not conflate successful diagnosis with policy rejection', () =>
    expect(auditLabel(details)).toBe('diagnosed'));
  it('rejects repairs without matching exact hashes and targets', () =>
    expect(
      RepairSchema.safeParse({
        path: '../escape',
        slug: 'fix',
        message: 'fix',
        unifiedDiff: '+a',
        expectedFileHashes: {},
        runner: 'jest',
        targets: [],
      }).success,
    ).toBe(false));
});
