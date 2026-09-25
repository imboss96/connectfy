import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const viteEntry = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const processes = [];

const startProcess = (command, args) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });
  processes.push(child);
  return child;
};

startProcess(process.execPath, [resolve(projectRoot, 'server.js')]);
const viteProcess = startProcess(process.execPath, [viteEntry, '--port=3000', '--host=0.0.0.0']);

const shutdown = () => {
  processes.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM');
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
viteProcess.on('exit', (code) => {
  shutdown();
  process.exit(code || 0);
});
