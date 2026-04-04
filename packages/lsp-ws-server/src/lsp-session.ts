import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServerProcess, createWebSocketConnection } from 'vscode-ws-jsonrpc/server';
import type { WebSocket } from 'ws';
import { asymmetricForward } from './asymmetric-forward.js';
import {
  createClientToServerMessageMap,
  createServerToClientMessageMap,
} from './lsp-uri-bridge.js';
import { resolveLanguageSpawn } from './language-spawn.js';
import { writeSessionTsconfig } from './session-tsconfig.js';
import { wsToIWebSocket } from './ws-socket-adapter.js';

export interface SessionLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const defaultLogger: SessionLogger = {
  info: (m) => console.log(`[lsp-ws-server] ${m}`),
  warn: (m) => console.warn(`[lsp-ws-server] ${m}`),
  error: (m) => console.error(`[lsp-ws-server] ${m}`),
};

/**
 * One WebSocket client ↔ one language server child process.
 * Uses `vscode-ws-jsonrpc`:
 * - `createWebSocketConnection` wraps the socket with JSON-RPC message reader/writer
 * - `createServerProcess` spawns the LS and uses stdio `StreamMessageReader` / `StreamMessageWriter`
 * - `forward` wires both directions and disposes the peer when one side closes
 */
export function startLspSession(
  ws: WebSocket,
  language: string,
  log: SessionLogger = defaultLogger,
): void {
  const sessionId = randomUUID().slice(0, 8);
  const spec = resolveLanguageSpawn(language);

  if (!spec) {
    log.warn(`[${sessionId}] Unsupported language: ${language}`);
    ws.close(4000, `Unsupported language: ${language}`);
    return;
  }

  const iSocket = wsToIWebSocket(ws);
  const clientConnection = createWebSocketConnection(iSocket);
  const serverConnection = createServerProcess(spec.name, spec.command, spec.args, {
    ...spec.spawnOptions,
    env: { ...process.env, ...spec.spawnOptions?.env },
  });

  if (!serverConnection) {
    log.error(`[${sessionId}] Failed to open stdio for ${spec.name}`);
    ws.close(1011, 'Language server stdio unavailable');
    return;
  }

  const sessionRoot = mkdtempSync(join(tmpdir(), `lsp-ws-${sessionId}-`));
  if (language.trim().toLowerCase() === 'typescript' || language.trim().toLowerCase() === 'ts') {
    writeSessionTsconfig(sessionRoot);
  }
  log.info(`[${sessionId}] Session workspace (host): ${sessionRoot}`);

  const toServer = createClientToServerMessageMap(sessionRoot);
  const toClient = createServerToClientMessageMap(sessionRoot);

  asymmetricForward(clientConnection, serverConnection, toServer, toClient);

  ws.on('close', () => {
    log.info(`[${sessionId}] WebSocket closed`);
    try {
      rmSync(sessionRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
}
