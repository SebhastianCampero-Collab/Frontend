import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import type { RemoteProps, RemoteHandle } from './contracts';
import { AdvancedOptions } from '../components/AdvancedOptions';
import { api } from '../api/client';

export function defineMount(Panel: ComponentType<RemoteProps>) {
  return (container: HTMLElement, initial: RemoteProps): RemoteHandle => {
    const root = createRoot(container, { onUncaughtError: () => { container.textContent = 'Este módulo no pudo continuar. Cambia de sección y vuelve a intentarlo; consulta el historial antes de repetir una reparación.'; } });
    let mounted = true;
    const render = (props: RemoteProps) => {
      if (!mounted || props.version !== 1) throw new Error('Contrato de microfrontend incompatible.');
      api.setToken(props.token); api.setTenant(props.tenantId);
      root.render(<AdvancedOptions.Provider value={props.advanced}>
        <fieldset disabled={props.readOnly} className="remote-frame" key={`${props.tenantId}:${props.project?.id ?? ''}`}>
          <Panel {...props} />
        </fieldset>
      </AdvancedOptions.Provider>);
    };
    render(initial);
    return { update: render, unmount() { if (mounted) { mounted = false; root.unmount(); api.setToken(''); api.setTenant(''); } } };
  };
}
