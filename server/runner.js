import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from './db.js';

const RUNNER_TMP_DIR = path.join(os.tmpdir(), 'aetherdesk-runner');
if (!fs.existsSync(RUNNER_TMP_DIR)) {
  fs.mkdirSync(RUNNER_TMP_DIR, { recursive: true });
}

export async function runSnippetCode(language, code, timeoutMs = 15000) {
  const startTime = Date.now();

  let cmd = '';
  let args = [];
  let tempFilePath = null;

  try {
    const timestamp = Date.now();
    if (language === 'python' || language === 'py') {
      tempFilePath = path.join(RUNNER_TMP_DIR, `snippet_${timestamp}.py`);
      fs.writeFileSync(tempFilePath, code, 'utf-8');
      cmd = 'python3';
      args = [tempFilePath];
    } else if (language === 'javascript' || language === 'node' || language === 'js') {
      tempFilePath = path.join(RUNNER_TMP_DIR, `snippet_${timestamp}.mjs`);
      fs.writeFileSync(tempFilePath, code, 'utf-8');
      cmd = 'node';
      args = [tempFilePath];
    } else if (language === 'bash' || language === 'sh') {
      tempFilePath = path.join(RUNNER_TMP_DIR, `snippet_${timestamp}.sh`);
      fs.writeFileSync(tempFilePath, code, 'utf-8');
      cmd = 'bash';
      args = [tempFilePath];
    } else {
      throw new Error(`Unsupported runner language: ${language}`);
    }

    return await executeProcess(cmd, args, timeoutMs, startTime, tempFilePath);
  } catch (err) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: err.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export async function executeAutomationScript(scriptId, timeoutMs = 25000) {
  const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
  if (!script) {
    throw new Error(`Script with ID ${scriptId} not found`);
  }

  const startTime = Date.now();
  const res = await executeProcess('bash', ['-c', script.command], timeoutMs, startTime);

  const status = res.success ? 'success' : 'failed';
  const preview = (res.stdout || res.stderr || '').slice(0, 1000);
  const nowStr = new Date().toLocaleString();

  db.prepare(`
    UPDATE scripts
    SET last_run = ?, last_status = ?, last_output = ?
    WHERE id = ?
  `).run(nowStr, status, preview, scriptId);

  return {
    ...res,
    scriptId,
    name: script.name,
    status,
  };
}

function executeProcess(cmd, args, timeoutMs, startTime, cleanupPath = null) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let isKilled = false;

    const proc = spawn(cmd, args, {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      cwd: process.cwd(),
    });

    const timer = setTimeout(() => {
      isKilled = true;
      proc.kill('SIGKILL');
      stderr += `\n[AetherDesk Execution Timeout after ${timeoutMs}ms]`;
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 50000) {
        proc.kill('SIGTERM');
        stdout += '\n[AetherDesk: Output truncated (>50KB)]';
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 50000) {
        proc.kill('SIGTERM');
        stderr += '\n[AetherDesk: Stderr truncated (>50KB)]';
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (cleanupPath && fs.existsSync(cleanupPath)) {
        try { fs.unlinkSync(cleanupPath); } catch (_) {}
      }

      const executionTimeMs = Date.now() - startTime;
      resolve({
        success: code === 0 && !isKilled,
        exitCode: isKilled ? -9 : (code ?? 0),
        stdout,
        stderr,
        executionTimeMs,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (cleanupPath && fs.existsSync(cleanupPath)) {
        try { fs.unlinkSync(cleanupPath); } catch (_) {}
      }

      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: err.message,
        executionTimeMs: Date.now() - startTime,
      });
    });
  });
}
