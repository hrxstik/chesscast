import { fetchWsTicket } from '@/lib/api/auth';
import { refreshSession } from '@/lib/api/auth';

/** Тикет для handshake Socket.IO; при 401 пробуем refresh. */
export async function resolveChessStreamSocketAuth(): Promise<{ ticket?: string }> {
  try {
    const ticket = await fetchWsTicket();
    return { ticket };
  } catch {
    try {
      await refreshSession();
      const ticket = await fetchWsTicket();
      return { ticket };
    } catch {
      return {};
    }
  }
}
