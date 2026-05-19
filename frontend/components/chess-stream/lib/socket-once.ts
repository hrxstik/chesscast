import type { Socket } from 'socket.io-client';
import type { ChessStreamWsError } from './mediasoup-socket.types';

export function waitSocketEvent<T>(
  socket: Socket,
  successEvent: string,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${successEvent} timeout`));
    }, timeoutMs);

    const onSuccess = (data: T) => {
      cleanup();
      resolve(data);
    };

    const onError = (error: ChessStreamWsError) => {
      cleanup();
      reject(new Error(error.message || 'WebSocket error'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(successEvent, onSuccess);
      socket.off('error', onError);
    };

    socket.once(successEvent, onSuccess);
    socket.once('error', onError);
  });
}
