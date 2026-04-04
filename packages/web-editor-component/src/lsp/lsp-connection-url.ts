import type { EditorLanguage } from '../languages/registry.js';

/**
 * Builds the WebSocket URL expected by `@web-editor/lsp-ws-server`:
 * `ws://host:port/lsp?language=<typescript|json|markdown|toml>`.
 *
 * - Preserves path, host, and existing query keys.
 * - Sets / overwrites `language` so the server can spawn the correct LS.
 */
export function buildLspWebSocketUrl(baseUrl: string, editorLanguage: EditorLanguage): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`[code-editor] Invalid lsp-url: ${JSON.stringify(baseUrl)}`);
  }
  url.searchParams.set('language', editorLanguage);
  return url.href;
}
