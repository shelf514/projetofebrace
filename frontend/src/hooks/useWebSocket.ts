import { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../services/api';

export function wsUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base || !/^https?:\/\//.test(base)) return '';
  return base.replace(/^http/, 'ws') + path;
}

export interface WsMessage<T = unknown> {
  type: string;
  data: T;
}

interface WebSocketState<T> {
  lastMessage: T | null;
  connected: boolean;
  error: string | null;
}

const MAX_RETRY_MS = 15000;

/**
 * Assina o WebSocket /ws/readings com reconexao automatica (backoff).
 * Se o ambiente nao suportar WebSocket, retorna connected=false e o
 * chamador deve usar o polling como fallback.
 */
export function useWebSocket<T>(path: string, enabled = true): WebSocketState<T> {
  const [state, setState] = useState<WebSocketState<T>>({
    lastMessage: null,
    connected: false,
    error: null,
  });
  const socketRef = useRef<WebSocket | null>(null);
  const retryMsRef = useRef(1000);
  const pathRef = useRef(path);
  pathRef.current = path;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // fullUrl recalculado a cada (re)conexao via getApiBaseUrl() atual — sem closure stale.
  const [urlTick, setUrlTick] = useState(0);

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined' || typeof window === 'undefined') return;
    const fullUrl = wsUrl(pathRef.current);
    if (!fullUrl) {
      setState((prev) => ({ ...prev, error: 'URL do backend invalida' }));
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(fullUrl);
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : 'WS inválido' }));
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        retryMsRef.current = 1000;
        setState((prev) => ({ ...prev, connected: true, error: null }));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as T;
          setState((prev) => ({ ...prev, lastMessage: message }));
        } catch {
          setState((prev) => ({ ...prev, error: 'Mensagem inválida recebida' }));
        }
      };

      socket.onerror = () => {
        setState((prev) => ({ ...prev, error: 'Erro na conexão WebSocket' }));
      };

      socket.onclose = () => {
        if (disposed) return;
        setState((prev) => ({ ...prev, connected: false }));
        retryTimer = setTimeout(connect, retryMsRef.current);
        retryMsRef.current = Math.min(retryMsRef.current * 2, MAX_RETRY_MS);
      };
    };

    connect();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'aquasense.api_url') {
        // reconecta lendo getApiBaseUrl() atual (sem reload, sem URL stale)
        retryMsRef.current = 1000;
        socketRef.current?.close();
        setUrlTick((t) => t + 1);
      }
    };
    const handleOnline = () => {
      retryMsRef.current = 1000;
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        setUrlTick((t) => t + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('online', handleOnline);

    // Heartbeat: fecha socket morto para forcar reconnect via onclose
    const heartbeat = setInterval(() => {
      const s = socketRef.current;
      if (s && s.readyState === WebSocket.OPEN) {
        try {
          s.send(JSON.stringify({ type: 'ping' }));
        } catch {
          /* onclose cuidara do reconnect */
        }
      }
    }, 30000);

    return () => {
      disposed = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', handleOnline);
      clearInterval(heartbeat);
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [path, enabled, urlTick]);

  return state;
}
