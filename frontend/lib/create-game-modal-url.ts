/** Открыть модалку создания игры через query (без отдельного /create-game). */
export function hrefCreateGameModal(organizationId?: number): string {
  const q = new URLSearchParams({ createGame: '1' });
  if (organizationId != null) {
    q.set('organizationId', String(organizationId));
  }
  return `?${q.toString()}`;
}

export function parseCreateGameModal(searchParams: URLSearchParams): {
  open: boolean;
  organizationId?: number;
} {
  if (searchParams.get('createGame') !== '1') {
    return { open: false };
  }
  const raw = searchParams.get('organizationId');
  if (!raw) return { open: true };
  const n = parseInt(raw, 10);
  return { open: true, organizationId: Number.isNaN(n) ? undefined : n };
}
