import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiClient } from '../src/api/client';
import { McpPanel } from '../src/components/McpPanel';
import { mcpTemplate } from '../src/utils/mcpTemplate';
import { project } from './fixtures';

const catalog = [
  { name: 'read_file_context', inputSchema: { type: 'object', required: ['projectId', 'path'], properties: { projectId: { type: 'string' }, path: { type: 'string' } } } },
  { name: 'analyze_code', inputSchema: { type: 'object', required: ['paths', 'checks'], properties: { paths: { type: 'array', minItems: 1, items: { type: 'string' } }, checks: { type: 'array', minItems: 1, items: { enum: ['syntax', 'semantic', 'lint'] } } } } },
  { name: 'git_apply_patch', inputSchema: { type: 'object', required: ['sessionId', 'attemptId', 'unifiedDiff', 'expectedFileHashes'], properties: { sessionId: { type: 'string' }, attemptId: { type: 'string' }, unifiedDiff: { type: 'string' }, expectedFileHashes: { type: 'object' } } } },
];

describe('MCP sandbox', () => {
  it('builds required drafts from published schemas without inventing IDs or hashes', () => {
    expect(JSON.parse(mcpTemplate(catalog[1]!.inputSchema))).toEqual({ paths: [''], checks: ['syntax'] });
    expect(JSON.parse(mcpTemplate(catalog[2]!.inputSchema))).toEqual({ sessionId: '', attemptId: '', unifiedDiff: '', expectedFileHashes: {} });
  });
  it('selects tools and fills drafts without executing, showing the warning', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(catalog);
    const call = vi.spyOn(api, 'callToolRaw');
    render(<McpPanel projectId={project.id} />);
    await screen.findByRole('option', { name: 'analyze_code' });
    expect(screen.getByRole('note')).toHaveTextContent('siguen sujetas a los guardrails del backend');
    expect(screen.getByLabelText('Argumentos JSON')).toHaveValue('{\n  "path": ""\n}');
    fireEvent.change(screen.getByLabelText('Herramienta MCP'), { target: { value: 'analyze_code' } });
    expect(JSON.parse((screen.getByLabelText('Argumentos JSON') as HTMLTextAreaElement).value)).toEqual({ paths: [''], checks: ['syntax'] });
    expect(call).not.toHaveBeenCalled();
  });
  it('renders the exact server guardrail result as JSON and clears it on tool change', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(catalog);
    const blocked = { isError: true, structuredContent: { ok: false, error: { code: 'PATH_PROTECTED', message: '.env blocked' } }, _meta: { auditId: 'audit-1' } };
    vi.spyOn(api, 'callToolRaw').mockResolvedValue(blocked);
    render(<McpPanel projectId={project.id} />);
    await screen.findByRole('option', { name: 'read_file_context' });
    fireEvent.change(screen.getByLabelText('Argumentos JSON'), { target: { value: '{"path":".env"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar petición' }));
    expect(JSON.parse((await screen.findByLabelText('Respuesta JSON')).textContent!)).toEqual(blocked);
    fireEvent.change(screen.getByLabelText('Herramienta MCP'), { target: { value: 'git_apply_patch' } });
    expect(screen.queryByLabelText('Respuesta JSON')).not.toBeInTheDocument();
  });
  it('clears the editor and response when changing projects', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(catalog);
    const view = render(<McpPanel projectId={project.id} />);
    await screen.findByRole('option', { name: 'read_file_context' });
    fireEvent.change(screen.getByLabelText('Argumentos JSON'), { target: { value: '{"path":"old-project.ts"}' } });
    view.rerender(<McpPanel projectId="another-project" />);
    await waitFor(() => expect(screen.getByLabelText('Argumentos JSON')).toHaveValue('{\n  "path": ""\n}'));
  });
  it('preserves raw MCP fields and enforces the selected project in the transport', async () => {
    const result = { isError: true, content: [{ type: 'text', text: 'blocked' }], structuredContent: { ok: false } };
    const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      expect(body.params).toEqual({ name: 'git_apply_patch', arguments: { projectId: project.id, unifiedDiff: 'diff' } });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await new ApiClient().callToolRaw('git_apply_patch', { projectId: 'foreign', unifiedDiff: 'diff' }, project.id)).toEqual(result);
  });
});
