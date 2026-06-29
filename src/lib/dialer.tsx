'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { callsApi, clientsApi } from '@/services/api';
import { getSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

type CallStatus = 'IDLE' | 'QUEUED' | 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_ANSWER' | 'FAILED';

interface CallState {
  status: CallStatus;
  callId: string | null;
  clientName: string;
  phone: string;
  clientId?: string;
  duration: number;
  startedAt: number | null;
  open: boolean;
}

interface DialerContextType {
  state: CallState;
  callClient: (clientId: string, clientName?: string, phone?: string) => Promise<void>;
  callNumber: (phone: string, clientId?: string, clientName?: string) => Promise<void>;
  hangup: () => Promise<void>;
  close: () => void;
  addNote: (note: string) => Promise<void>;
}

const INITIAL: CallState = {
  status: 'IDLE',
  callId: null,
  clientName: '',
  phone: '',
  duration: 0,
  startedAt: null,
  open: false,
};

const DialerContext = createContext<DialerContextType>({
  state: INITIAL,
  callClient: async () => {},
  callNumber: async () => {},
  hangup: async () => {},
  close: () => {},
  addNote: async () => {},
});

export function DialerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CallState>(INITIAL);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onQueued = (data: any) => {
      setState((s) => ({
        ...s,
        callId: data.callId,
        clientName: data.clientName || 'Notanish',
        phone: data.phone || '',
        clientId: data.clientId,
        status: 'QUEUED',
        open: true,
        startedAt: null,
        duration: 0,
      }));
    };

    const onStatus = (data: any) => {
      setState((s) => {
        if (s.callId !== data.callId) return s;
        const next = { ...s, status: data.status as CallStatus };
        if (data.status === 'IN_PROGRESS' && !s.startedAt) {
          next.startedAt = Date.now();
        }
        if (data.duration !== undefined) next.duration = data.duration;
        return next;
      });
    };

    const onFailed = (data: any) => {
      setState((s) => ({ ...s, status: 'FAILED' }));
      toast.error(data?.error || "Qo'ng'iroq amalga oshmadi");
    };

    const onWarning = (data: any) => {
      toast(data?.message || 'Sinov rejimi: real qongiroq emas', { icon: '⚠️', duration: 6000 });
    };

    socket.on('call:queued', onQueued);
    socket.on('call:status', onStatus);
    socket.on('call:failed', onFailed);
    socket.on('call:warning', onWarning);

    return () => {
      socket.off('call:queued', onQueued);
      socket.off('call:status', onStatus);
      socket.off('call:failed', onFailed);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (state.status === 'IN_PROGRESS' && state.startedAt) {
      timerRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          duration: Math.floor((Date.now() - (s.startedAt || Date.now())) / 1000),
        }));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status, state.startedAt]);

  const callClient = async (clientId: string, clientName?: string, phone?: string) => {
    try {
      setState({
        ...INITIAL,
        callId: 'pending',
        clientName: clientName || 'Yuklanmoqda...',
        phone: phone || '',
        clientId,
        status: 'QUEUED',
        open: true,
      });
      // v8: callsApi.initiate ishlatamiz — phone provider'lardan o'tadi
      const res = await callsApi.initiate({ toPhone: phone || '', clientId });
      const data = res.data;
      if (data?.id) {
        setState((s) => ({ ...s, callId: data.id }));
      }
      // v8: tel: link bo'lsa, telefonni ochish
      if (data?.clientAction?.type === 'tel') {
        window.location.href = data.clientAction.payload;
      }
    } catch (e: any) {
      setState(INITIAL);
      toast.error(e.response?.data?.message || "Qo'ng'iroq xato");
    }
  };

  const callNumber = async (phone: string, clientId?: string, clientName?: string) => {
    try {
      setState({
        ...INITIAL,
        callId: 'pending',
        clientName: clientName || phone,
        phone,
        clientId,
        status: 'QUEUED',
        open: true,
      });
      const res = await callsApi.initiate({ toPhone: phone, clientId });
      const data = res.data;
      if (data?.id) {
        setState((s) => ({ ...s, callId: data.id }));
      }
      // v8: tel: link bo'lsa, telefonni ochish
      if (data?.clientAction?.type === 'tel') {
        window.location.href = data.clientAction.payload;
      }
    } catch (e: any) {
      setState(INITIAL);
      toast.error(e.response?.data?.message || "Qo'ng'iroq xato");
    }
  };

  const hangup = async () => {
    if (!state.callId || state.callId === 'pending') {
      setState(INITIAL);
      return;
    }
    try {
      await callsApi.hangup(state.callId);
      setState((s) => ({ ...s, status: 'COMPLETED' }));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xato');
    }
  };

  const close = () => setState(INITIAL);

  const addNote = async (note: string) => {
    if (!state.callId || state.callId === 'pending') return;
    try {
      await callsApi.addNote(state.callId, note);
      toast.success('Izoh saqlandi');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xato');
    }
  };

  return (
    <DialerContext.Provider value={{ state, callClient, callNumber, hangup, close, addNote }}>
      {children}
    </DialerContext.Provider>
  );
}

export const useDialer = () => useContext(DialerContext);
