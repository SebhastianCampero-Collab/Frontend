import { useState } from 'react';
import { Play } from 'lucide-react';
import { useMcpTools } from '../hooks/useMcpTools';
import { message, ApiError } from '../api/client';
import { record } from '../types/contracts';
import { mcpTemplate } from '../utils/mcpTemplate';
import { Empty, ErrorNotice, JsonDetails } from './ui';

export function McpPanel({ projectId }: { projectId: string }) {
  return <McpSandbox key={projectId} projectId={projectId} />;
}
function McpSandbox({ projectId }: { projectId: string }) {
  const mcp = useMcpTools(projectId);
  const [selected, setSelected] = useState('git_status');
  const [draft, setDraft] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown>(undefined);
  const tool = mcp.data?.find((item) => item.name === selected) ?? mcp.data?.[0];
  const args = draft ?? (tool ? mcpTemplate(tool.inputSchema) : '{}');
  const busy = mcp.invocation.pending;
  const invoke = async () => {
    setValidation(null); setResponse(undefined);
    try {
      const parsed: unknown = JSON.parse(args);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error('Los argumentos deben ser un objeto JSON.');
      if (tool) setResponse(await mcp.call(tool.name, record(parsed)));
    } catch (error: unknown) {
      setValidation(message(error));
      if (error instanceof ApiError && error.rawResponse !== undefined) setResponse(error.rawResponse);
    }
  };
  return (
    <div className="mcp-sandbox">
      <p className="notice" role="note">
        Modo Avanzado: Las ejecuciones directas ignoran la UI, pero siguen sujetas a los guardrails del backend
      </p>
      <div className="mcp-layout sandbox-columns">
        <section className="panel mcp-editor">
          <div className="section-heading">
            <h2>Petición MCP</h2><span className="count">{mcp.data?.length ?? 0} tools</span>
          </div>
          <label>Herramienta MCP
            <select value={tool?.name ?? ''} disabled={busy || mcp.loading || !mcp.data?.length}
              onChange={(event) => {
                setSelected(event.target.value); setDraft(null); setValidation(null);
                setResponse(undefined); mcp.invocation.reset();
              }}>
              {!mcp.data?.length && <option value="">Sin herramientas disponibles</option>}
              {mcp.data?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <button className="ghost" onClick={mcp.refresh} disabled={mcp.loading || busy}>
            {mcp.loading ? 'Cargando catálogo…' : 'Actualizar catálogo'}
          </button>
          <ErrorNotice error={mcp.error} />
          {!mcp.loading && !mcp.data?.length && <Empty>No se pudo recuperar el catálogo.</Empty>}
          <p>{tool?.description}</p>
          {tool && <JsonDetails value={tool.inputSchema} label="Ver inputSchema y parámetros requeridos" />}
          <p className="notice">
            El proyecto seleccionado se inyecta como <code>projectId</code> y no puede sobrescribirse.
            Las herramientas ejecutan operaciones reales. Completa los campos vacíos con rutas,
            identificadores y hashes reales; el servidor valida los argumentos.
          </p>
          <label>Argumentos JSON
            <textarea className="sandbox-code" rows={18} disabled={busy} spellCheck={false}
              autoCapitalize="off" autoCorrect="off" value={args}
              onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button className="primary" disabled={!tool || !projectId || busy || mcp.loading}
            onClick={() => void invoke()}>
            <Play size={15} />{busy ? 'Ejecutando…' : 'Ejecutar petición'}
          </button>
          <ErrorNotice error={validation ?? mcp.invocation.error} />
        </section>
        <section className="panel sandbox-response" aria-busy={busy}>
          <h2>Respuesta del Servidor</h2>
          <p>Muestra el resultado MCP sin transformar sus campos. Los errores de transporte se indican junto a la petición.</p>
          {busy && <p role="status">Esperando respuesta del servidor…</p>}
          {response !== undefined
            ? <pre className="sandbox-code" aria-label="Respuesta JSON"><code>{JSON.stringify(response, null, 2)}</code></pre>
            : !busy && <Empty>Ejecuta una petición para ver la respuesta JSON.</Empty>}
        </section>
      </div>
    </div>
  );
}
