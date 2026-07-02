'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/services/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

/**
 * WebSocket ulanish hook
 *
 * Backend bilan real-time aloqa: notification, message, typing indicator.
 *
 * @example
 * const { socket, connected } = useSocket();
 * useEffect(() => {
 *   socket?.on('notification:new', (n) => toast.success(n.title));
 * }, [socket]);
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // XAVFSIZLIK TUZATISH: token endi localStorage emas, memory'dan olinadi.
    // hydrate() asinxron bo'lgani uchun token kechroq paydo bo'lishi mumkin —
    // shu sabab qisqa polling bilan kutamiz.
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const token = getAccessToken();
      if (!token || cancelled) return false;

      if (!socketInstance) {
        socketInstance = io(API_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });
      }
      return true;
    };

    if (!connect()) {
      pollTimer = setInterval(() => {
        if (connect()) {
          if (pollTimer) clearInterval(pollTimer);
          attach();
        }
      }, 500);
      return () => {
        cancelled = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    function attach() {
      const s = socketInstance;
      if (!s || cancelled) return;
      setSocket(s);

      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onError = (err: any) => {
        console.warn('Socket error:', err.message);
        setConnected(false);
      };

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('error', onError);

      if (s.connected) setConnected(true);
    }

    attach();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      const s = socketInstance;
      if (s) {
        s.off('connect');
        s.off('disconnect');
        s.off('error');
      }
    };
  }, []);

  return { socket, connected };
}

/** Real-time notifications listener */
export function useRealtimeNotifications(onNotification: (n: any) => void) {
  const { socket } = useSocket();
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!socket) return;
    const handler = (n: any) => callbackRef.current(n);
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket]);
}

/** Conversation real-time listener */
export function useConversationRealtime(
  conversationId: string | null,
  onMessage: (msg: any) => void,
  onTyping?: (data: { userId: string; isTyping: boolean }) => void,
) {
  const { socket } = useSocket();
  const msgRef = useRef(onMessage);
  const typingRef = useRef(onTyping);
  msgRef.current = onMessage;
  typingRef.current = onTyping;

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('conversation:join', { conversationId });

    const onMsg = (msg: any) => msgRef.current(msg);
    const onType = (data: any) => {
      if (data.conversationId === conversationId && typingRef.current) {
        typingRef.current(data);
      }
    };
    socket.on('message:new', onMsg);
    socket.on('user:typing', onType);

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.off('message:new', onMsg);
      socket.off('user:typing', onType);
    };
  }, [socket, conversationId]);

  const sendTyping = (isTyping: boolean) => {
    if (socket && conversationId) {
      socket.emit('typing', { conversationId, isTyping });
    }
  };

  return { sendTyping };
}

/** Disconnect socket on logout */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/** Get the current socket instance (for non-React code like DialerProvider) */
export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!socketInstance) {
    const token = getAccessToken(); // memory'dan (localStorage emas)
    if (!token) return null;
    socketInstance = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socketInstance;
}