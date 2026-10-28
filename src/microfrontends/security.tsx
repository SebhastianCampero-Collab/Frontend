import { GuardrailsPanel } from '../components/GuardrailsPanel';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Security(props: RemoteProps) { return props.project ? <GuardrailsPanel projectId={props.project.id} /> : <p>Selecciona un proyecto.</p>; }
export const version = 1;
export const mount = defineMount(Security);
