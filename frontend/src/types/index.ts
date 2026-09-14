export interface Reading {
  id: number;
  device_id: string;
  timestamp: string;
  temperature: number;
  turbidity: number;
  tds: number;
  prediction: string | null;
  prediction_probability: number | null;
  anomaly: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  name: string;
  api_key: string | null;
  last_seen: string | null;
  status: string;
  created_at: string;
}

export interface ReadingStats {
  count: number;
  anomaly_count?: number;
  temperature?: { min: number; max: number; avg: number };
  turbidity?: { min: number; max: number; avg: number };
  tds?: { min: number; max: number; avg: number };
}

export interface OverfittingInfo {
  train_score: number;
  test_score: number;
  overfit_gap: number;
  warning: boolean;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface MLStatus {
  model_loaded: boolean;
  message?: string;
  version?: string;
  trained_at?: string;
  dataset?: string;
  dataset_origin?: string;
  features?: string[];
  target?: string;
  task?: string;
  model?: string;
  n_samples?: number;
  labels?: string[] | null;
  metrics?: Record<string, number | string | ConfusionMatrix>;
  overfitting?: OverfittingInfo;
  feature_importance?: FeatureImportance[];
}

export interface Health {
  status: string;
  database: string;
  model_loaded: boolean;
  model_version: string | null;
  model_trained_at: string | null;
  uptime_seconds: number;
}

export type Period = '24h' | '7d' | '30d' | 'custom';

export interface WsMessage<T = unknown> {
  type: string;
  data: T;
}

export interface WsReadingMessage extends WsMessage<Reading> {
  type: 'reading';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  especie?: string | null;
  include_sensor_context?: boolean;
  conversation_id?: string | null;
  temperature?: number | null;
  turbidity?: number | null;
  tds?: number | null;
}

export interface ChatResponse {
  reply: string;
  sources: string[];
  model_used: string;
  especie?: string | null;
}

export type EspecieOption = { especie: string; nome: string };
