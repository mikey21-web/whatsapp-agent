'use client';

import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  const token = useAuth.getState().accessToken;
  socket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
