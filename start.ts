#!/usr/bin/env tsx
/**
 * Start the A2UI Restaurant Finder (server + chosen client).
 * Usage: tsx start.ts [react|lit|shadcn]
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type ClientChoice = 'react' | 'lit' | 'shadcn';

interface ClientConfig {
  dir: string;
  port: number;
  label: string;
}

const CLIENT_CONFIGS: Record<ClientChoice, ClientConfig> = {
  react: { dir: 'client', port: 5003, label: 'React' },
  lit: { dir: 'client-lit', port: 5004, label: 'Lit' },
  shadcn: { dir: 'client-shadcn', port: 5005, label: 'Shadcn' },
};

const SERVER_PORT = 10002;
const STARTUP_DELAY_MS = 2000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(__dirname, 'packages');

function parseClientChoice(arg: string | undefined): ClientChoice {
  if (arg === 'lit') return 'lit';
  if (arg === 'shadcn') return 'shadcn';
  return 'react';
}

function startProcess(name: string, cwd: string, command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err: Error) => {
    console.error(`Failed to start ${name}: ${err.message}`);
    process.exit(1);
  });

  return child;
}

function main(): void {
  const choice: ClientChoice = parseClientChoice(process.argv[2]);
  const clientConfig: ClientConfig = CLIENT_CONFIGS[choice];

  console.log(`Starting A2UI Restaurant Finder (${choice} client)...\n`);

  // [1/2] Start backend server
  console.log(`[1/2] Starting backend server (port ${SERVER_PORT})...`);
  const server: ChildProcess = startProcess(
    'server',
    resolve(packagesDir, 'server'),
    'pnpm',
    ['exec', 'tsx', 'src/index.ts'],
  );

  // Wait for server to be ready, then start client
  setTimeout(() => {
    console.log(`[2/2] Starting ${clientConfig.label} client (port ${clientConfig.port})...`);
    const client: ChildProcess = startProcess(
      'client',
      resolve(packagesDir, clientConfig.dir),
      'pnpm',
      ['exec', 'vite'],
    );

    const children: ChildProcess[] = [server, client];

    const shutdown = (): void => {
      for (const child of children) {
        child.kill();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log('');
    console.log(`Server:  http://localhost:${SERVER_PORT}`);
    console.log(`Client:  http://localhost:${clientConfig.port}`);
    console.log('');
    console.log('Press Ctrl+C to stop both.');
  }, STARTUP_DELAY_MS);
}

main();
