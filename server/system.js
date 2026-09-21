import fs from 'node:fs';
import os from 'node:os';
import { exec, execSync } from 'node:child_process';
import util from 'node:util';

const execAsync = util.promisify(exec);

let prevCpuStats = null;
let prevNetStats = null;
let prevTime = Date.now();

// Static system info cached at startup
let staticInfo = null;

export function getStaticSystemInfo() {
  if (staticInfo) return staticInfo;

  let osName = 'Linux';
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf-8');
    const match = osRelease.match(/PRETTY_NAME="([^"]+)"/) || osRelease.match(/PRETTY_NAME=([^\n]+)/);
    if (match) osName = match[1];
  } catch (e) {
    osName = `${os.type()} ${os.release()}`;
  }

  let kernel = 'Unknown';
  try {
    kernel = execSync('uname -r', { encoding: 'utf-8' }).trim();
  } catch (e) {
    kernel = os.release();
  }

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Generic CPU';
  const cpuCount = cpus.length;

  staticInfo = {
    hostname: os.hostname(),
    osName,
    kernel,
    arch: os.arch(),
    cpuModel,
    cpuCount,
    nodeVersion: process.version,
    platform: process.platform,
  };

  return staticInfo;
}

// Read and compute CPU usage metrics
function getCpuMetrics() {
  try {
    const statData = fs.readFileSync('/proc/stat', 'utf-8');
    const lines = statData.split('\n');
    const currentStats = {};

    for (const line of lines) {
      if (!line.startsWith('cpu')) break;
      const parts = line.trim().split(/\s+/);
      const name = parts[0];
      const numbers = parts.slice(1).map(Number);
      const idle = numbers[3] + (numbers[4] || 0); // idle + iowait
      const total = numbers.reduce((a, b) => a + b, 0);
      currentStats[name] = { idle, total };
    }

    const cpuPercents = {};
    let overallUsage = 0;
    const perCore = [];

    if (prevCpuStats) {
      for (const [name, curr] of Object.entries(currentStats)) {
        const prev = prevCpuStats[name];
        if (prev) {
          const totalDiff = curr.total - prev.total;
          const idleDiff = curr.idle - prev.idle;
          const usage = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 1000) / 10)) : 0;
          if (name === 'cpu') {
            overallUsage = usage;
          } else {
            perCore.push({
              core: name,
              usage,
            });
          }
        }
      }
    }

    prevCpuStats = currentStats;

    return {
      usagePercent: overallUsage,
      cores: perCore,
    };
  } catch (e) {
    return { usagePercent: 0, cores: [] };
  }
}

// Read and parse /proc/meminfo
function getMemoryMetrics() {
  try {
    const memData = fs.readFileSync('/proc/meminfo', 'utf-8');
    const map = {};
    for (const line of memData.split('\n')) {
      const parts = line.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const val = parseInt(parts[1].trim().split(' ')[0], 10);
        map[key] = val; // in kB
      }
    }

    const totalKB = map.MemTotal || 0;
    const freeKB = map.MemFree || 0;
    const availKB = map.MemAvailable || freeKB;
    const usedKB = totalKB - availKB;
    const cachedKB = (map.Cached || 0) + (map.Buffers || 0);
    const swapTotalKB = map.SwapTotal || 0;
    const swapFreeKB = map.SwapFree || 0;
    const swapUsedKB = swapTotalKB - swapFreeKB;

    return {
      totalMB: Math.round(totalKB / 1024),
      usedMB: Math.round(usedKB / 1024),
      freeMB: Math.round(freeKB / 1024),
      availableMB: Math.round(availKB / 1024),
      cachedMB: Math.round(cachedKB / 1024),
      percent: totalKB > 0 ? Math.round((usedKB / totalKB) * 1000) / 10 : 0,
      swap: {
        totalMB: Math.round(swapTotalKB / 1024),
        usedMB: Math.round(swapUsedKB / 1024),
        percent: swapTotalKB > 0 ? Math.round((swapUsedKB / swapTotalKB) * 1000) / 10 : 0,
      },
    };
  } catch (e) {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      totalMB: Math.round(total / (1024 * 1024)),
      usedMB: Math.round((total - free) / (1024 * 1024)),
      freeMB: Math.round(free / (1024 * 1024)),
      availableMB: Math.round(free / (1024 * 1024)),
      cachedMB: 0,
      percent: Math.round(((total - free) / total) * 1000) / 10,
      swap: { totalMB: 0, usedMB: 0, percent: 0 },
    };
  }
}

// Read network traffic speeds from /proc/net/dev
function getNetworkMetrics(now) {
  try {
    const netData = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = netData.split('\n').slice(2);
    let totalRx = 0;
    let totalTx = 0;

    for (const line of lines) {
      if (!line.includes(':')) continue;
      const [iface, stats] = line.split(':');
      const cleanIface = iface.trim();
      if (cleanIface === 'lo') continue; // ignore loopback

      const numbers = stats.trim().split(/\s+/).map(Number);
      const rx = numbers[0];
      const tx = numbers[8];
      totalRx += rx;
      totalTx += tx;
    }

    let rxRateKBs = 0;
    let txRateKBs = 0;

    if (prevNetStats) {
      const timeDeltaSec = Math.max(0.1, (now - prevTime) / 1000);
      const rxDiff = totalRx - prevNetStats.rx;
      const txDiff = totalTx - prevNetStats.tx;
      rxRateKBs = Math.max(0, Math.round((rxDiff / 1024 / timeDeltaSec) * 10) / 10);
      txRateKBs = Math.max(0, Math.round((txDiff / 1024 / timeDeltaSec) * 10) / 10);
    }

    prevNetStats = { rx: totalRx, tx: totalTx };

    return {
      rxRateKBs,
      txRateKBs,
      totalRxMB: Math.round(totalRx / (1024 * 1024)),
      totalTxMB: Math.round(totalTx / (1024 * 1024)),
    };
  } catch (e) {
    return { rxRateKBs: 0, txRateKBs: 0, totalRxMB: 0, totalTxMB: 0 };
  }
}

// Read disk storage metrics via df
async function getDiskMetrics() {
  try {
    const { stdout } = await execAsync('df -h -P / | tail -n 1');
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 6) {
      return {
        mount: parts[5],
        filesystem: parts[0],
        total: parts[1],
        used: parts[2],
        available: parts[3],
        percent: parseInt(parts[4].replace('%', ''), 10) || 0,
      };
    }
  } catch (e) {
    // fallback
  }
  return {
    mount: '/',
    filesystem: 'rootfs',
    total: 'N/A',
    used: 'N/A',
    available: 'N/A',
    percent: 0,
  };
}

// Get top running processes
export async function getTopProcesses(limit = 10) {
  try {
    const { stdout } = await execAsync(
      `ps -eo pid,user,%cpu,%mem,time,comm --sort=-%cpu | head -n ${limit + 1}`
    );
    const lines = stdout.trim().split('\n');
    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 6) {
        processes.push({
          pid: parts[0],
          user: parts[1],
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          time: parts[4],
          name: parts.slice(5).join(' '),
        });
      }
    }
    return processes;
  } catch (e) {
    return [];
  }
}

// Kill a process by PID
export async function killProcess(pid) {
  const numericPid = parseInt(pid, 10);
  if (isNaN(numericPid) || numericPid <= 1) {
    throw new Error('Invalid PID target');
  }
  await execAsync(`kill -9 ${numericPid}`);
  return { success: true, pid: numericPid };
}

// Aggregate full snapshot
export async function getFullSystemTelemetry() {
  const now = Date.now();
  const cpu = getCpuMetrics();
  const memory = getMemoryMetrics();
  const network = getNetworkMetrics(now);
  const disk = await getDiskMetrics();
  const loadavg = os.loadavg();
  const uptime = Math.round(os.uptime());

  prevTime = now;

  return {
    timestamp: now,
    static: getStaticSystemInfo(),
    cpu,
    memory,
    network,
    disk,
    loadavg: {
      '1m': Math.round(loadavg[0] * 100) / 100,
      '5m': Math.round(loadavg[1] * 100) / 100,
      '15m': Math.round(loadavg[2] * 100) / 100,
    },
    uptimeSeconds: uptime,
  };
}
