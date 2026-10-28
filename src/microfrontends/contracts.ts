import type { ImportReady, Project } from '../types/contracts';
export const remoteNames = ['projects', 'review', 'results', 'security', 'subagents', 'mcp'] as const;
export type RemoteName = typeof remoteNames[number];
/** Versioned browser boundary. No remote receives a DB credential or writes another remote's DOM. */
export interface RemoteProps {
  readonly version: 1;
  readonly token: string;
  readonly tenantId: string;
  readonly readOnly: boolean;
  readonly advanced: boolean;
  readonly project?: Project;
  readonly onReady: (result: ImportReady) => void;
  readonly onComplete: () => void;
  readonly onBusyChange: (busy: boolean) => void;
}
export interface RemoteHandle { update(props: RemoteProps): void; unmount(): void }
export interface RemoteModule { readonly version: 1; mount(container: HTMLElement, props: RemoteProps): RemoteHandle }
