import type { ChatRequest, ChatResponse, Device, EspecieFicha, EspecieResumo, Health, MLStatus, Reading, ReadingStats, RecomendarRequest, RecomendarResponse, CompatibilidadeResult } from '../types';

const STORAGE_KEY = 'aquasense.api_url';

function readStoredUrl(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  } catch {
    /* modo privado/APK restrito: ignora storage */
  }
  return null;
}

export function isValidApiUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

export function getApiBaseUrl(): string {
  const saved = readStoredUrl();
  if (saved && isValidApiUrl(saved)) return saved;
  const envUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
  if (envUrl && isValidApiUrl(envUrl)) return envUrl;
  // Device físico não resolve localhost do PC — default do emulador Android.
  try {
    if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) && typeof window !== 'undefined' && window.location.protocol.startsWith('capacitor')) {
      return 'http://10.0.2.2:8000';
    }
  } catch { /* ignore */ }
  // Mesma origem: no Render (VITE_API_URL vazio) e no `npm run dev` (proxy do Vite),
  // a API está na mesma origem da página. Evita apontar para localhost do visitante.
  try {
    if (typeof window !== 'undefined' && typeof window.location?.origin === 'string' && window.location.origin.startsWith('http')) {
      return window.location.origin.replace(/\/+$/, '');
    }
  } catch { /* ignore */ }
  return 'http://localhost:8000';
}

export function setApiBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed && !isValidApiUrl(trimmed)) {
    throw new Error('URL deve começar com http:// ou https://');
  }
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    throw new Error('Não foi possível salvar (armazenamento indisponível)');
  }
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch { /* ignore */ }
}

export function getApiKey(): string {
  return import.meta.env.VITE_API_KEY ?? '';
}

async function request<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const apiKey = getApiKey();
  if (apiKey) headers['X-API-Key'] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Tempo esgotado (15s)', 'AbortError')), 15000);
  const onExternalAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onExternalAbort, { once: true });
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(signal?.aborted ? 'Requisição cancelada' : 'Tempo esgotado (15s)');
    }
    throw e instanceof Error ? e : new Error('Erro de rede');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const body = JSON.parse(text) as { detail?: unknown };
          if (typeof body?.detail === 'string') detail = `${response.status}: ${body.detail}`;
          else if (body?.detail !== undefined) detail = `${response.status}: ${JSON.stringify(body.detail).slice(0, 300)}`;
        } catch {
          detail = `${response.status}: ${text.slice(0, 200)}`;
        }
      }
    } catch {
      // corpo nao-JSON
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Resposta inválida do servidor');
  }
}

export const api = {
  health: () => request<Health>('/api/health'),
  devices: () => request<Device[]>('/api/devices'),
  device: (id: string) => request<Device>(`/api/devices/${encodeURIComponent(id)}`),
  readings: (params: { device_id?: string; limit?: number; offset?: number; anomaly?: boolean; prediction?: string }) => {
    const qs = new URLSearchParams();
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    if (params.anomaly !== undefined) qs.set('anomaly', String(params.anomaly));
    if (params.prediction) qs.set('prediction', params.prediction);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Reading[]>(`/api/readings${suffix}`);
  },
  latestReading: (device_id?: string) => {
    const qs = device_id ? `?device_id=${encodeURIComponent(device_id)}` : '';
    return request<Reading>(`/api/readings/latest${qs}`);
  },
  history: (params: { start?: string; end?: string; device_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Reading[]>(`/api/readings/history${suffix}`);
  },
  stats: (params: { start?: string; end?: string; device_id?: string }) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.device_id) qs.set('device_id', params.device_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ReadingStats>(`/api/readings/stats${suffix}`);
  },
  mlStatus: () => request<MLStatus>('/api/ml/status'),
  chat: (payload: ChatRequest, signal?: AbortSignal) => request<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(payload), signal }),
  especies: () => request<{ especies: { especie: string; nome: string; ph_min: number; ph_max: number }[]; total: number }>('/api/chat/especies'),
  chatHistory: (id: string) => request<{ conversation_id: string; messages: { role: string; content: string }[]; count: number }>(`/api/chat/history/${encodeURIComponent(id)}`),
  chatHistoryDelete: (id: string) => request<{ deleted: boolean }>(`/api/chat/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  aquarismoEspecies: () => request<{ especies: EspecieResumo[]; total: number }>('/api/aquarismo/especies'),
  aquarismoFicha: (especie: string) => request<EspecieFicha>(`/api/aquarismo/especies/${encodeURIComponent(especie)}`),
  aquarismoCompatibilidade: (a: string, b: string) => request<CompatibilidadeResult>(`/api/aquarismo/compatibilidade?especie_a=${encodeURIComponent(a)}&especie_b=${encodeURIComponent(b)}`),
  aquarismoRecomendar: (payload: RecomendarRequest) => request<RecomendarResponse>('/api/aquarismo/recomendar', { method: 'POST', body: JSON.stringify(payload) }),
};

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
