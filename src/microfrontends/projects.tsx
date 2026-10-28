import { GitHubImport } from '../components/GitHubImport';
import { defineMount } from './mount';
import type { RemoteProps } from './contracts';
function Projects(props: RemoteProps) { return <GitHubImport onReady={props.onReady} onBusyChange={props.onBusyChange} />; }
export const version = 1;
export const mount = defineMount(Projects);
