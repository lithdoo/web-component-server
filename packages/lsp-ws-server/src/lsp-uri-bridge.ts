import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, normalize, relative } from 'node:path';
import { Message } from 'vscode-jsonrpc';

function deepStringMap(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') {
    return fn(value);
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((x) => deepStringMap(x, fn));
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = deepStringMap(o[k], fn);
    }
    return out;
  }
  return value;
}

/**
 * Map browser virtual workspace `file:///workspace/...` to a real temp directory on the Node host.
 */
export function clientWorkspaceUriToServerPath(uri: string, sessionRoot: string): string {
  if (!uri.startsWith('file:')) {
    return uri;
  }
  const m = uri.match(/^file:\/\/\/workspace(\/.*)?$/i);
  if (m) {
    const suffix = m[1] ? m[1].slice(1) : '';
    const localPath = suffix ? join(sessionRoot, decodeURIComponent(suffix)) : sessionRoot;
    return pathToFileURL(normalize(localPath)).href;
  }
  try {
    const p = fileURLToPath(uri);
    const norm = p.replace(/\\/g, '/');
    const idx = norm.toLowerCase().indexOf('/workspace/');
    if (idx >= 0) {
      const rel = norm.slice(idx + '/workspace/'.length);
      return pathToFileURL(normalize(join(sessionRoot, rel))).href;
    }
    if (norm.toLowerCase().endsWith('/workspace') || norm.toLowerCase().endsWith('\\workspace')) {
      return pathToFileURL(normalize(sessionRoot)).href;
    }
  } catch {
    /* ignore */
  }
  return uri;
}

/**
 * Map server temp file URLs back to `file:///workspace/...` for the browser language client.
 */
export function serverUriToClientWorkspaceUri(uri: string, sessionRoot: string): string {
  if (!uri.startsWith('file:')) {
    return uri;
  }
  try {
    const abs = normalize(fileURLToPath(uri));
    const root = normalize(sessionRoot);
    const rel = relative(root, abs);
    if (rel.startsWith('..') || rel.startsWith('/') || rel === '') {
      if (abs.toLowerCase() === root.toLowerCase()) {
        return 'file:///workspace';
      }
      return uri;
    }
    return `file:///workspace/${rel.replace(/\\/g, '/')}`;
  } catch {
    return uri;
  }
}

function mapFileUrisInMessage(msg: Message, mapUri: (s: string) => string): Message {
  const stringMap = (s: string) => {
    if (!s.startsWith('file:')) {
      return s;
    }
    return mapUri(s);
  };

  if (Message.isRequest(msg)) {
    return { ...msg, params: deepStringMap(msg.params, stringMap) } as Message;
  }
  if (Message.isNotification(msg)) {
    if (msg.params === undefined) {
      return msg;
    }
    return { ...msg, params: deepStringMap(msg.params, stringMap) } as Message;
  }
  if (Message.isResponse(msg)) {
    const out = { ...msg } as Message & {
      result?: unknown;
      error?: unknown;
    };
    if (msg.result !== undefined) {
      out.result = deepStringMap(msg.result, stringMap);
    }
    if (msg.error !== undefined) {
      out.error = deepStringMap(msg.error, stringMap);
    }
    return out as Message;
  }
  return msg;
}

export function createClientToServerMessageMap(sessionRoot: string): (m: Message) => Message {
  return (m) => mapFileUrisInMessage(m, (u) => clientWorkspaceUriToServerPath(u, sessionRoot));
}

export function createServerToClientMessageMap(sessionRoot: string): (m: Message) => Message {
  return (m) => mapFileUrisInMessage(m, (u) => serverUriToClientWorkspaceUri(u, sessionRoot));
}
