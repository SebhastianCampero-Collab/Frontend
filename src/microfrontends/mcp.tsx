import { McpPanel } from '../components/McpPanel';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Mcp(props: RemoteProps) { return props.project ? <McpPanel projectId={props.project.id} /> : <p>Selecciona un proyecto.</p>; }
export const version = 1;
export const mount = defineMount(Mcp);
