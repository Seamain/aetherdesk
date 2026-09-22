import type { Task, Snippet, ScriptItem, WebhookEvent, PomodoroStats, NoteItem, TopProcess } from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'aether-token';

export function getAuthToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function setAuthToken(v: string): void {
  try {
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    try { window.dispatchEvent(new CustomEvent('aether:unauthorized')); } catch {}
  }
  if (!res.ok || (json as any).success === false) {
    throw new Error((json as any).error || `HTTP error ${res.status}`);
  }
  return (json as any).data !== undefined ? (json as any).data : json;
}

export const api = {
  // System
  getProcesses: (limit = 15) => request<TopProcess[]>(`/system/processes?limit=${limit}`),
  killProcess: (pid: string) => request<{ success: boolean; pid: number }>('/system/kill-process', {
    method: 'POST',
    body: JSON.stringify({ pid }),
  }),

  // Tasks
  getTasks: () => request<Task[]>('/tasks'),
  createTask: (data: Partial<Task>) => request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTask: (id: number, data: Partial<Task>) => request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteTask: (id: number) => request<{ message: string }>(`/tasks/${id}`, {
    method: 'DELETE',
  }),

  // Snippets
  getSnippets: () => request<Snippet[]>('/snippets'),
  createSnippet: (data: Partial<Snippet>) => request<Snippet>('/snippets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateSnippet: (id: number, data: Partial<Snippet>) => request<Snippet>(`/snippets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteSnippet: (id: number) => request<{ success: boolean }>(`/snippets/${id}`, {
    method: 'DELETE',
  }),

  // Automation Scripts
  getScripts: () => request<ScriptItem[]>('/scripts'),
  createScript: (data: Partial<ScriptItem>) => request<ScriptItem>('/scripts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateScript: (id: number, data: Partial<ScriptItem>) => request<ScriptItem>(`/scripts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  runScript: (id: number) => request<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    status: string;
  }>(`/scripts/${id}/run`, {
    method: 'POST',
  }),
  deleteScript: (id: number) => request<{ success: boolean }>(`/scripts/${id}`, {
    method: 'DELETE',
  }),

  // Sandbox Runner
  runSnippetCode: (language: string, code: string) => request<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
  }>('/runner/run', {
    method: 'POST',
    body: JSON.stringify({ language, code }),
  }),

  // Webhooks
  getWebhooks: () => request<WebhookEvent[]>('/webhooks'),
  clearWebhooks: () => request<{ message: string }>('/webhooks', {
    method: 'DELETE',
  }),
  deleteWebhook: (id: number) => request<{ success: boolean }>(`/webhooks/${id}`, {
    method: 'DELETE',
  }),

  // Pomodoro
  getPomodoroStats: () => request<PomodoroStats>('/pomodoro/stats'),
  logPomodoroSession: (mode: string, duration_seconds: number, task_title: string) =>
    request<{ id: number }>('/pomodoro/log', {
      method: 'POST',
      body: JSON.stringify({ mode, duration_seconds, task_title }),
    }),

  // Notes
  getNotes: () => request<NoteItem[]>('/notes'),
  createNote: (data: Partial<NoteItem>) => request<NoteItem>('/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateNote: (id: number, data: Partial<NoteItem>) => request<NoteItem>(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteNote: (id: number) => request<{ success: boolean }>(`/notes/${id}`, {
    method: 'DELETE',
  }),

  // Mini HTTP proxy client
  sendHttpRequest: (data: { url: string; method: string; headers?: Record<string, string>; body?: unknown }) =>
    request<{
      status: number;
      statusText: string;
      durationMs: number;
      headers: Record<string, string>;
      data: unknown;
    }>('/proxy/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
