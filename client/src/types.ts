export interface StaticSystemInfo {
  hostname: string;
  osName: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  nodeVersion: string;
  platform: string;
}

export interface CoreMetric {
  core: string;
  usage: number;
}

export interface CpuMetrics {
  usagePercent: number;
  cores: CoreMetric[];
}

export interface MemoryMetrics {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  availableMB: number;
  cachedMB: number;
  percent: number;
  swap: {
    totalMB: number;
    usedMB: number;
    percent: number;
  };
}

export interface NetworkMetrics {
  rxRateKBs: number;
  txRateKBs: number;
  totalRxMB: number;
  totalTxMB: number;
}

export interface DiskMetrics {
  mount: string;
  filesystem: string;
  total: string;
  used: string;
  available: string;
  percent: number;
}

export interface SystemTelemetry {
  timestamp: number;
  static: StaticSystemInfo;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  disk: DiskMetrics;
  loadavg: {
    '1m': number;
    '5m': number;
    '15m': number;
  };
  uptimeSeconds: number;
}

export interface TopProcess {
  pid: string;
  user: string;
  cpu: number;
  mem: number;
  time: string;
  name: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Snippet {
  id: number;
  title: string;
  language: string;
  code: string;
  tags: string;
  description: string;
  is_favorite: number;
  created_at: string;
}

export interface ScriptItem {
  id: number;
  name: string;
  command: string;
  category: string;
  description: string;
  last_run: string | null;
  last_status: string | null;
  last_output: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: number;
  endpoint: string;
  method: string;
  headers: string;
  query: string;
  payload: string;
  ip: string;
  received_at: string;
}

export interface PomodoroStats {
  logs: Array<{
    id: number;
    mode: string;
    duration_seconds: number;
    task_title: string;
    completed_at: string;
  }>;
  today: {
    count: number;
    totalMinutes: number;
  };
}

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  pinned: number;
  updated_at: string;
}
