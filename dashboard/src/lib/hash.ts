export const VIEWS = ['overview', 'findings', 'remediations', 'relationships', 'services', 'baselines', 'activity'] as const;
export type View = (typeof VIEWS)[number];

export interface HashState {
  view: View;
  params: URLSearchParams;
}

export function parseHash(hash: string): HashState {
  const h = hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const view = (VIEWS as readonly string[]).includes(path) ? (path as View) : 'overview';
  return { view, params: new URLSearchParams(query) };
}

export function buildHash(view: View, params?: URLSearchParams | Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  if (params instanceof URLSearchParams) params.forEach((v, k) => p.set(k, v));
  else if (params) for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const q = p.toString();
  return `#/${view}${q ? `?${q}` : ''}`;
}

/** Same view, with `changes` applied (null/'' deletes a key). */
export function withParams(state: HashState, changes: Record<string, string | null>): string {
  const p = new URLSearchParams(state.params);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') p.delete(k);
    else p.set(k, v);
  }
  return buildHash(state.view, p);
}
