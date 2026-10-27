import { useEffect, useSyncExternalStore } from 'react';

export const routes = {
  projects: '/projects', review: '/review', results: '/results',
  hooks: '/advanced/hooks', agents: '/advanced/agents', mcp: '/advanced/mcp',
} as const;
export type Route = keyof typeof routes;
const snapshot = (): Route => (Object.keys(routes) as Route[]).find((key) => `#${routes[key]}` === window.location.hash) ?? 'projects';
const subscribe = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};
export function navigate(route: Route): void {
  if (window.location.hash === `#${routes[route]}`) return;
  window.location.hash = routes[route];
}
/** Hash URLs survive refresh on static hosts without server rewrite rules. */
export function useNavigation() {
  const route = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    if (!Object.values(routes).some((path) => window.location.hash === `#${path}`))
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${routes.projects}`);
  }, [route]);
  return { route, navigate, advancedRoute: ['hooks', 'agents', 'mcp'].includes(route) };
}
