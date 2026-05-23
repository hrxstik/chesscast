import { fetchWsTicket, refreshSession } from '@/lib/api/auth';

export class StreamAuthRequiredError extends Error {
  constructor(message = 'STREAM_AUTH_REQUIRED') {
    super(message);
    this.name = 'StreamAuthRequiredError';
  }
}

export type ChessStreamSocketAuthOptions = {
  requireAuth?: boolean;
};

export type ChessStreamSocketConnect = {
  url: string;
  ticket: string | null;
};

/** Краткоживущий JWT для Socket.IO (cookies в WS handshake не всегда доходят). */
export async function fetchChessStreamWsTicket(): Promise<string> {
  try {
    return await fetchWsTicket();
  } catch {
    await refreshSession();
    try {
      return await fetchWsTicket();
    } catch {
      throw new StreamAuthRequiredError();
    }
  }
}

/** URL и тикет для Socket.IO (как S-CRM: ?token= + auth.ticket). */
export async function buildChessStreamSocketConnect(
  wsBaseUrl: string,
  options: ChessStreamSocketAuthOptions = {},
): Promise<ChessStreamSocketConnect> {
  const base = `${wsBaseUrl.replace(/\/$/, '')}/chess-stream`;
  const { requireAuth = true } = options;
  if (!requireAuth) {
    return { url: base, ticket: null };
  }

  const ticket = await fetchChessStreamWsTicket();
  return {
    url: `${base}?token=${encodeURIComponent(ticket)}`,
    ticket,
  };
}
