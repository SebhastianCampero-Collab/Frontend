import { z } from 'zod';
import { explainError } from '../utils/errors';
import { ProjectFilesSchema } from '../types/contracts';
import { ImportEventSchema } from '../types/contracts';
import type { ImportEvent } from '../types/contracts';
import {
  AuditDetailsSchema,
  DemoSetupSchema,
  AuditRunSchema,
  HealthSchema,
  HookConfigSchema,
  HookEvaluationSchema,
  HookLogSchema,
  DelegationSchema,
  McpToolSchema,
  ProjectSchema,
  RegisterProjectSchema,
  record,
} from '../types/contracts';
import type { AuditRequest, ListFilter, RegisterProject } from '../types/contracts';

export class ApiError extends Error {
  readonly technicalMessage: string;
  constructor(
    message: string,
    public readonly status = 0,
    public readonly code = 'NETWORK_ERROR',
    public readonly requestId?: string,
  ) {
    super(explainError(message, status));
    this.technicalMessage = message;
    this.name = 'ApiError';
  }
}
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001').replace(
  /\/+$/,
  '',
);
function query(filter: ListFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}
export class ApiClient {
  private token = '';
  private rpcId = 0;
  constructor(public readonly baseUrl = API_URL) {}
  setToken(value: string): void {
    this.token = value.trim();
  }
  async importProject(url: string, onEvent: (event: ImportEvent) => void, signal: AbortSignal): Promise<void> {
    const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' });
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${this.baseUrl}/api/projects/import`, {
      method: 'POST', headers, body: JSON.stringify({ url }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
    });
    if (!response.ok) {
      const payload: unknown = await response.json();
      const error = record(record(payload)['error']);
      throw new ApiError(typeof error['message'] === 'string' ? error['message'] : 'No se pudo iniciar la importación.', response.status);
    }
    if (!response.body || !response.headers.get('Content-Type')?.includes('text/event-stream'))
      throw new ApiError('El servidor no devolvió un flujo de progreso válido.');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', terminal = false;
    try {
      while (!terminal) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        buffer = buffer.replace(/\r\n/g, '\n');
        if (buffer.length > 131072) throw new ApiError('Respuesta de importación demasiado grande.');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const lines = frame.split('\n');
          const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
          if (!event) continue;
          const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
          const parsed = ImportEventSchema.parse({ event, data: JSON.parse(data) as unknown });
          onEvent(parsed);
          terminal = parsed.event !== 'progress';
          if (terminal) break;
        }
        if (done) break;
      }
      if (!terminal) throw new ApiError('La conexión se interrumpió antes de confirmar el resultado. Revisa la lista de proyectos antes de reintentar.');
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  private async exchange(
    path: string,
    body: unknown,
    signal?: AbortSignal,
    timeoutMs = 15000,
  ): Promise<{ response: Response; payload: unknown }> {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const headers = new Headers({
        Accept: path === '/api/mcp' ? 'application/json, text/event-stream' : 'application/json',
      });
      if (body !== undefined) headers.set('Content-Type', 'application/json');
      if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (response.status === 202 || response.status === 204) return { response, payload: null };
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ApiError(
          'El servidor no devolvió JSON válido.',
          response.status,
          'INVALID_RESPONSE',
        );
      }
      return { response, payload };
    } catch (error: unknown) {
      if (error instanceof ApiError || signal?.aborted) throw error;
      throw new ApiError(
        timeout.aborted
          ? 'La solicitud agotó su tiempo. Consulta el historial antes de repetir una operación.'
          : 'No se pudo conectar con el backend. Verifica la URL, CORS y el servidor.',
        0,
        timeout.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      );
    }
  }
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    signal?: AbortSignal,
    special = false,
  ): Promise<T> {
    const { response, payload } = await this.exchange(
      path,
      body,
      signal,
      body === undefined ? 15000 : 180000,
    );
    const envelope = record(payload);
    if (
      (!response.ok || envelope['ok'] !== true) &&
      !(special && (response.status === 403 || response.status === 503) && 'data' in envelope)
    ) {
      const error = record(envelope['error']);
      throw new ApiError(
        typeof error['message'] === 'string' ? error['message'] : `Error HTTP ${response.status}`,
        response.status,
        typeof error['code'] === 'string' ? error['code'] : 'HTTP_ERROR',
        response.headers.get('X-Request-Id') ?? undefined,
      );
    }
    const parsed = schema.safeParse(envelope['data']);
    if (!parsed.success)
      throw new ApiError(
        'La respuesta no coincide con el contrato del backend.',
        response.status,
        'INVALID_RESPONSE',
      );
    return parsed.data;
  }
  health = (signal?: AbortSignal, path: '/health' | '/api/health' = '/api/health') =>
    this.request(path, HealthSchema, undefined, signal, true);
  projects = (signal?: AbortSignal) =>
    this.request('/api/projects', z.array(ProjectSchema), undefined, signal);
  projectFiles = (projectId: string, signal?: AbortSignal) => this.request(`/api/projects/${encodeURIComponent(projectId)}/files`, ProjectFilesSchema, undefined, signal);
  registerProject = (input: RegisterProject) =>
    this.request('/api/projects', ProjectSchema, RegisterProjectSchema.parse(input));
  prepareDemo = () => this.request('/api/demo/prepare', DemoSetupSchema, {});
  audits = (filter: ListFilter = {}, signal?: AbortSignal) =>
    this.request(`/api/audits${query(filter)}`, z.array(AuditDetailsSchema), undefined, signal);
  audit = (id: string, signal?: AbortSignal) =>
    this.request(`/api/audits/${encodeURIComponent(id)}`, AuditDetailsSchema, undefined, signal);
  runAudit = (input: AuditRequest) => this.request('/api/audits/run', AuditRunSchema, input);
  hookConfig = (signal?: AbortSignal) =>
    this.request('/api/hooks/config', HookConfigSchema, undefined, signal);
  hookLogs = (filter: ListFilter = {}, signal?: AbortSignal) =>
    this.request(`/api/hooks/logs${query(filter)}`, z.array(HookLogSchema), undefined, signal);
  evaluateHook = (projectId: string, files: string[], unifiedDiff: string) =>
    this.request(
      '/api/hooks/evaluate',
      HookEvaluationSchema,
      { projectId, files, unifiedDiff },
      undefined,
      true,
    );
  delegations = (filter: ListFilter = {}, signal?: AbortSignal) =>
    this.request(
      `/api/subagents/delegations${query(filter)}`,
      z.array(DelegationSchema),
      undefined,
      signal,
    );
  async rpc(
    method: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const id = ++this.rpcId;
    const { response, payload } = await this.exchange(
      '/api/mcp',
      { jsonrpc: '2.0', id, method, params },
      signal,
      180000,
    );
    const rpc = record(payload);
    if (rpc['error'])
      throw new ApiError(
        String(record(rpc['error'])['message'] ?? 'Error de protocolo MCP'),
        response.status,
        'MCP_ERROR',
      );
    if (!response.ok || rpc['jsonrpc'] !== '2.0' || rpc['id'] !== id || !('result' in rpc))
      throw new ApiError('Respuesta JSON-RPC inválida.', response.status, 'MCP_ERROR');
    return rpc['result'];
  }
  async listTools(signal?: AbortSignal) {
    await this.rpc(
      'initialize',
      {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'devguardian-dashboard', version: '1.0.0' },
      },
      signal,
    );
    const { response } = await this.exchange(
      '/api/mcp',
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      signal,
    );
    if (!response.ok)
      throw new ApiError('No se pudo inicializar MCP.', response.status, 'MCP_ERROR');
    return z
      .object({ tools: z.array(McpToolSchema) })
      .parse(await this.rpc('tools/list', {}, signal)).tools;
  }
  async callTool(name: string, args: Record<string, unknown>, projectId: string) {
    const result = record(
      await this.rpc('tools/call', { name, arguments: { ...args, projectId } }),
    );
    let domain = result['structuredContent'];
    if (domain === undefined) {
      const text = z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .parse(result['content'])
        .find((item) => item.type === 'text')?.text;
      if (!text) throw new ApiError('MCP no devolvió contenido.', 200, 'INVALID_RESPONSE');
      try {
        domain = JSON.parse(text);
      } catch {
        throw new ApiError('Contenido MCP inválido.', 200, 'INVALID_RESPONSE');
      }
    }
    const envelope = z
      .object({
        ok: z.boolean(),
        data: z.unknown().optional(),
        error: z.object({ code: z.string(), message: z.string() }).optional(),
      })
      .parse(domain);
    if (!envelope.ok || result['isError'] === true)
      throw new ApiError(
        envelope.error?.message ?? 'La herramienta rechazó la solicitud.',
        200,
        envelope.error?.code ?? 'MCP_TOOL_ERROR',
        typeof record(result['_meta'])['auditId'] === 'string'
          ? String(record(result['_meta'])['auditId'])
          : undefined,
      );
    return { data: envelope.data, meta: result['_meta'] };
  }
}
export const api = new ApiClient();
export function message(error: unknown): string {
  return error instanceof Error ? explainError(error.message, error instanceof ApiError ? error.status : undefined) : 'No se pudo completar la operación.';
}
