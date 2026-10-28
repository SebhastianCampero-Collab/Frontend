import { AgentMonitorView } from '../components/AgentMonitorView';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Subagents(props: RemoteProps) { return props.project ? <AgentMonitorView projectId={props.project.id} /> : <p>Selecciona un proyecto.</p>; }
export const version = 1;
export const mount = defineMount(Subagents);
