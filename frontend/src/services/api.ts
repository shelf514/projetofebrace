import type { Device, Health, MLStatus, Reading, ReadingStats } from '../types';

const STORAGE_KEY = 'aquasense.api_url';

export function getApiBaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  }
  return (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''));
}

export function getApiKey(): string {
  return import.meta.env.VITE_API_KEY ?? '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const apiKey = getApiKey();
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      // corpo nao-JSON: mantem o status
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<Health>('/api/health'),
  devices: () => request<Device[]>('/api/devices'),
  device: (id: string) => request<Device>(`/api/devices/${encodeURIComponent(id)}`),
  readings: (params: { device_id?: string; limit?: number; offset?: number; anomaly?: boolean; prediction?: string }) => {
    const qs = new URLSearchParams();
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.anomaly !== undefined) qs.set('anomaly', String(params.anomaly));
    if (params.prediction) qs.set('prediction', params.prediction);
    return request<Reading[]>(`/api/readings?${qs.toString()}`);
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
    if (params.limit) qs.set('limit', String(params.limit));
    return request<Reading[]>(`/api/readings/history?${qs.toString()}`);
  },
  stats: (params: { start?: string; end?: string; device_id?: string }) => {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.device_id) qs.set('device_id', params.device_id);
    return request<ReadingStats>(`/api/readings/stats?${qs.toString()}`);
  },
  mlStatus: () => request<MLStatus>('/api/ml/status'),
};

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
