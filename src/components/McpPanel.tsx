import { useState } from 'react';
import { Braces, Play } from 'lucide-react';
import { useMcpTools } from '../hooks/useMcpTools';
import { message, ApiError } from '../api/client';
import { record } from '../types/contracts';
import { Empty, ErrorNotice, JsonDetails } from './ui';
export function McpPanel({ projectId }: { projectId: string }) {
  const mcp = useMcpTools(projectId);
  const [selected, setSelected] = useState('git_status');
  const [args, setArgs] = useState('{}');
  const [validation, setValidation] = useState<string | null>(null);
  const [auditId, setAuditId] = useState('');
  const tool = mcp.data?.find((item) => item.name === selected) ?? mcp.data?.[0];
  const invoke = async () => {
    setValidation(null);
    setAuditId('');
    try {
      const parsed: unknown = JSON.parse(args);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('Los argumentos deben ser un objeto JSON.');
      if (tool) await mcp.call(tool.name, record(parsed));
    } catch (error: unknown) {
      setValidation(message(error));
      if (error instanceof ApiError && error.requestId) setAuditId(error.requestId);
    }
  };
  return (
    <div className="mcp-layout">
      <section className="panel catalog">
        <div className="section-heading">
          <div>
            <span className="eyebrow">04 / MODEL CONTEXT PROTOCOL</span>
            <h2>Catálogo MCP</h2>
          </div>
          <span className="count">{mcp.data?.length ?? 0} tools</span>
        </div>
        <p>Esquemas efectivos publicados por el servidor.</p>
        <button
          className="ghost"
          onClick={mcp.refresh}
          disabled={mcp.loading || mcp.invocation.pending}
        >
          Ejecutar tools/list
        </button>
        <ErrorNotice error={mcp.error} />
        <div className="tool-list">
          {mcp.data?.map((item) => (
            <button
              key={item.name}
              disabled={mcp.invocation.pending}
              className={tool?.name === item.name ? 'selected' : ''}
              onClick={() => {
                setSelected(item.name);
                setArgs('{}');
                setValidation(null);
                mcp.invocation.reset();
              }}
            >
              <Braces size={15} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        {!mcp.loading && !mcp.data?.length && <Empty>No se pudo recuperar el catálogo.</Empty>}
      </section>
      <section className="panel mcp-editor">
        <div className="section-heading">
          <h2>{tool?.name ?? 'Selecciona una herramienta'}</h2>
          <span className="eyebrow">TOOLS/CALL</span>
        </div>
        <p>{tool?.description}</p>
        {tool && (
          <JsonDetails value={tool.inputSchema} label="Ver inputSchema y parámetros requeridos" />
        )}
        <p className="notice">
          El proyecto seleccionado se inyecta como <code>projectId</code>. Las herramientas Git y de
          pruebas ejecutan operaciones reales en ese proyecto.
        </p>
        <label>
          Argumentos JSON
          <textarea
            rows={13}
            disabled={mcp.invocation.pending}
            spellCheck={false}
            value={args}
            onChange={(event) => setArgs(event.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={!tool || !projectId || mcp.invocation.pending || mcp.loading}
          onClick={() => void invoke()}
        >
          <Play size={15} />
          {mcp.invocation.pending ? 'Ejecutando…' : 'Ejecutar herramienta'}
        </button>
        <ErrorNotice error={validation ?? mcp.invocation.error} />
        {auditId && (
          <p>
            Auditoría de la llamada: <code>{auditId}</code>
          </p>
        )}
        {mcp.invocation.data && (
          <div className="mcp-result">
            <JsonDetails value={mcp.invocation.data} label="Resultado y metadatos de la llamada" />
          </div>
        )}
      </section>
    </div>
  );
}
