import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from '../config.js';

export function usesBundledBrowsers() {
  return process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1'
    || process.env.PLAYWRIGHT_BROWSERS_PATH === '/ms-playwright';
}

export function browserRuntimeAvailable() {
  return process.env.RENDER !== 'true' || usesBundledBrowsers();
}

export function configureBrowserPath() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.RENDER === 'true') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(config.packageRoot, '.playwright');
  }
  return process.env.PLAYWRIGHT_BROWSERS_PATH || '';
}

let pending = null;

export function ensureFirefox() {
  configureBrowserPath();
  if (process.env.RENDER !== 'true' || usesBundledBrowsers()) {
    return Promise.resolve();
  }
  if (!pending) {
    pending = runInstall().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

function runInstall() {
  const cli = path.join(config.packageRoot, 'node_modules', 'playwright', 'cli.js');
  console.log('[jobbot] Installing Firefox into the project. Render does not keep the browser cache from the build.');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'install', 'firefox'], {
      env: process.env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`playwright install firefox exited ${code}`));
      }
    });
  });
}
