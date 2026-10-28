import { AuditPanel } from '../components/AuditPanel';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Results(props: RemoteProps) { return props.project ? <AuditPanel project={props.project} view="results" /> : <p>Selecciona un proyecto para consultar su historial.</p>; }
export const version = 1;
export const mount = defineMount(Results);
