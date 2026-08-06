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
          reconnectionDelayMax: 10000,
          // v15 FIX: avval `reconnectionAttempts: 5` edi — ya'ni internet
          // biroz uzoqroq (bir necha soniyadan ortiq) uzilib qolsa, socket.io
          // 5 marta urinib, KEYIN BUTUNLAY TO'XTAB QOLARDI va sahifa qo'lda
          // yangilanmaguncha (F5) qayta hech qachon ulanmasdi. Shu payt
          // Telegramga kelgan xabarlar CRM'da UMUMAN ko'rinmasdi — aynan
          // "CRM'dan chiqib ketsam xabar kelmayapti" shikoyatining asosiy
          // sabablaridan biri. Endi cheksiz urinadi (backoff bilan, serverga
          // ortiqcha yuk bermasdan).
          reconnectionAttempts: Infinity,
        });
      }
      return true;
    };

    // v15 FIX: bu tinglovchilar ilgari faqat token DARHOL mavjud bo'lgan
    // holatdagina (pastdagi `attach()` bilan bir yo'lda) qo'shilardi — token
    // hali tayyor bo'lmay, polling orqali kechroq ulanadigan holatda esa
    // (early-return tarmog'ida) HECH QACHON qo'shilmasdi. Endi ikkala holatda
    // ham ishlashi uchun eng boshida, shartsiz qo'shamiz.
    const forceReconnectIfNeeded = () => {
      const s = socketInstance;
      if (s && !s.connected) {
        s.connect();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceReconnectIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', forceReconnectIfNeeded);
    window.addEventListener('focus', forceReconnectIfNeeded);

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

    const cleanupListeners = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', forceReconnectIfNeeded);
      window.removeEventListener('focus', forceReconnectIfNeeded);
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
        cleanupListeners();
      };
    }

    attach();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      cleanupListeners();
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

/**
 * v15: socket (qayta) ulanganda yoki tab yana ko'rinadigan bo'lganda berilgan
 * callback'ni chaqiradi — shu orqali offlayn/fonda turgan vaqtda "o'tkazib
 * yuborilgan" ma'lumotlarni (masalan Telegramdan kelgan xabarlar) qaytadan
 * so'rovga chiqarib, ekranni haqiqiy holat bilan sinxronlashtirish mumkin.
 * Ulanish paytida socket'dagi hodisalar (masalan `message:new`) faqat
 * SHU ULANISH DAVOMIDA kelgan narsalarni ushlaydi — uzilib turgan vaqtda
 * kelgan hech narsa "kutib" turmaydi, shu sabab reconnect'da to'liq
 * qayta-so'rov qilish shart.
 */
export function useResyncOnReconnect(onResync: () => void) {
  const { socket } = useSocket();
  const cbRef = useRef(onResync);
  cbRef.current = onResync;
  const hadConnectedOnce = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const trigger = () => cbRef.current();

    const onConnect = () => {
      // Birinchi ulanishda emas — FAQAT qayta ulanganda (ya'ni ilgari bir
      // marta ulangan, keyin uzilgan, endi tiklangan) chaqiramiz. Sahifa
      // birinchi ochilganda ma'lumot allaqachon oddiy REST so'rov orqali
      // yuklanadi — bu yerda takror qilish shart emas.
      if (hadConnectedOnce.current) trigger();
      hadConnectedOnce.current = true;
    };
    socket.on('connect', onConnect);
    if (socket.connected) hadConnectedOnce.current = true;

    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', trigger);
    window.addEventListener('online', trigger);

    return () => {
      socket.off('connect', onConnect);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', trigger);
      window.removeEventListener('online', trigger);
    };
  }, [socket]);
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
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });
  }
  return socketInstance;
}