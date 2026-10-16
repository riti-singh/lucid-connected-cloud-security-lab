export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—';
}

export function osvUrl(id: string): string {
  return `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;
}

export function advisoryMatchesFinding(
  a: { id: string; aliases: string[] },
  f: { advisory_id: string | null; aliases: string[] },
): boolean {
  if (!f.advisory_id) return false;
  return a.id === f.advisory_id || a.aliases.includes(f.advisory_id) || f.aliases.includes(a.id);
}
