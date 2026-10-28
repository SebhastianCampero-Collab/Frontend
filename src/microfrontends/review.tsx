import { AuditPanel } from '../components/AuditPanel';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Review(props: RemoteProps) { return props.project ? <AuditPanel project={props.project} view="review" onComplete={props.onComplete} onBusyChange={props.onBusyChange} /> : <p>Importa o selecciona un proyecto para revisarlo.</p>; }
export const version = 1;
export const mount = defineMount(Review);
