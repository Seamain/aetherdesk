import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AETHER_DB_PATH: absolute path, or relative to project root (default data/aetherdesk.db)
const DB_REL = process.env.AETHER_DB_PATH || 'data/aetherdesk.db';
const DB_PATH = path.isAbsolute(DB_REL) ? DB_REL : path.join(__dirname, '..', DB_REL);
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Initialize schema
export function initDB() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      category TEXT DEFAULT 'Dev',
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      language TEXT NOT NULL,
      code TEXT NOT NULL,
      tags TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      category TEXT DEFAULT 'Maintenance',
      description TEXT DEFAULT '',
      last_run TEXT,
      last_status TEXT,
      last_output TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      headers TEXT,
      query TEXT,
      payload TEXT,
      ip TEXT,
      received_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS pomodoro_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT DEFAULT 'work',
      duration_seconds INTEGER NOT NULL,
      task_title TEXT DEFAULT '',
      completed_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Seed default data if tasks is empty
  const taskCount = db.prepare('SELECT count(*) as count FROM tasks').get();
  if (taskCount.count === 0) {
    seedDefaultData();
  }
}

function seedDefaultData() {
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, category)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'Linux 桌面调优与平滑动画配置',
    '检查 Hyprland 渲染器性能，验证 144Hz 刷新率以及窗口亚克力模糊效果与功耗平衡。',
    'in_progress',
    'high',
    'System'
  );

  insertTask.run(
    'Docker 容器清理与卷垃圾回收自动化',
    '编写定时守护进程自动化移除 dangling images 与匿名 volumes。',
    'todo',
    'medium',
    'DevOps'
  );

  insertTask.run(
    'API 网关与 Webhook 回调监听测试',
    '使用 AetherDesk Webhook 捕获箱监听第三方推送并模拟并发报警。',
    'review',
    'urgent',
    'API'
  );

  insertTask.run(
    '重构本地开发工作站数据库索引',
    '对高频查询字段建立复合索引并开启 WAL 模式加速并发读取。',
    'done',
    'low',
    'Database'
  );

  // Seed default snippets
  const insertSnippet = db.prepare(`
    INSERT INTO snippets (title, language, code, tags, description, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSnippet.run(
    '快速查看监听端口与关联进程',
    'bash',
    `ss -tulpn | grep LISTEN | awk '{print $1, $5, $7}'`,
    'network,cli,linux',
    '精确列出系统当前所有处于监听状态的 TCP/UDP 端口及 PID',
    1
  );

  insertSnippet.run(
    'Docker 一键清理未使用的镜像与容器',
    'bash',
    `docker system prune -af --volumes`,
    'docker,maintenance',
    '彻底清理虚悬镜像、已停止容器和未引用的命名卷',
    1
  );

  insertSnippet.run(
    'cURL 接口性能与耗时全维度测试',
    'bash',
    `curl -w "\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s "https://api.github.com"`,
    'curl,http,benchmark',
    '高精度测量 HTTP/HTTPS 各阶段网络耗时（DNS、TCP、TLS握手、首字节）',
    1
  );

  insertSnippet.run(
    'Python 临时跨平台高速 HTTP 文件服务器',
    'python',
    `import http.server, socketserver
PORT = 8888
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://0.0.0.0:{PORT}")
    httpd.serve_forever()`,
    'python,web,utility',
    '零依赖快速在局域网分享当前目录文件',
    0
  );

  insertSnippet.run(
    'Git 回退最近一次提交但保留更改',
    'bash',
    `git reset --soft HEAD~1`,
    'git,version-control',
    '撤销上一次 commit，并将改动放回暂存区',
    0
  );

  // Seed default automation scripts
  const insertScript = db.prepare(`
    INSERT INTO scripts (name, command, category, description)
    VALUES (?, ?, ?, ?)
  `);

  insertScript.run(
    '系统内存与缓存状态',
    'free -h && echo "" && vmstat -s | head -n 8',
    'System',
    '查看当前系统物理内存、交换分区与缓冲占用详情'
  );

  insertScript.run(
    '磁盘挂载与容量诊断',
    'df -h -x tmpfs -x devtmpfs -x efivarfs',
    'System',
    '过滤虚拟临时系统，仅显示真实硬盘分区的存储消耗情况'
  );

  insertScript.run(
    '网络活动连接与监听统计',
    'ss -s && echo "" && ss -tulpn | head -n 12',
    'Network',
    '汇总 TCP 套接字状态统计及正在监听的核心服务'
  );

  insertScript.run(
    'CPU 占用最高的 TOP 10 进程',
    'ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 11',
    'Monitor',
    '快速捕获当前系统资源消耗大户'
  );

  insertScript.run(
    'Git 工作区状态极速汇总',
    'git status -s 2>/dev/null || echo "当前目录非 Git 仓库"',
    'Dev',
    '检查仓库内未跟踪、未暂存与已修改的文件列表'
  );

  // Seed default notes
  const insertNote = db.prepare(`
    INSERT INTO notes (title, content, pinned)
    VALUES (?, ?, ?)
  `);

  insertNote.run(
    '🚀 AetherDesk 架构与极客指南',
    `# 欢迎使用 AetherDesk 开发者工作台！

- **系统态势舱**: 实时毫秒级采集 \`/proc\` 系统内核数据，掌握 CPU/内存/磁盘/网络动态。
- **任务敏捷流**: 专注目标管理，卡片拖曳与快速优先级调度。
- **极客专注钟**: 纯 Web Audio 声音合成，免除外部依赖，支持番茄工作法。
- **代码实验室**: 直接在仪表盘中即时运行 Python、Node.js 与 Bash 脚本。
- **Webhook 捕获箱**: 外部 Webhook 实时回显，调试接口利器。
`,
    1
  );
}
