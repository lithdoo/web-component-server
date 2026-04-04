/**
 * LSP over WebSocket: `LanguageClientWrapper` (monaco-languageclient) opens the socket and uses
 * `vscode-ws-jsonrpc` for JSON-RPC message framing compatible with VS Code language servers.
 *
 * ## Client initialization flow (what happens after `LanguageClientWrapper.start()`)
 *
 * 1. **Transport** — `new WebSocket(url)`; on `open`, `MonacoLanguageClient` receives
 *    `MessageTransports` (`WebSocketMessageReader` / `WebSocketMessageWriter`).
 * 2. **`initialize`** — `vscode-languageclient` sends `initialize` with capabilities
 *    (text sync, completion, hover, publishDiagnostics, etc.) and workspace folders.
 * 3. **`initialized`** — notification after successful `initialize` response.
 * 4. **Feature registration** — `BaseLanguageClient` registers VS Code providers that delegate to
 *    the language server (completion, hover, signature help, diagnostics, etc.).
 * 5. **Document sync** — When the Monaco-backed text model matches `documentSelector`, open/change/close
 *    notifications are emitted automatically (incremental sync where supported).
 * 6. **Completion / cursor** — There is no standing “cursor sync” notification in LSP. On suggest
 *    (e.g. Ctrl+Space or `quickSuggestions`), the client sends `textDocument/completion` with a
 *    `TextDocumentPositionParams` built from the **current** editor selection.
 */
/**
 * 不要从 `vscode-languageclient/browser.js` 做运行时 import：该子路径无 `exports` 字段，
 * 在 pnpm / 部分 Rollup 解析下会报 “failed to resolve import”。
 * 类型从包入口 `typings`（lib/common/api）解析；ErrorAction / CloseAction 在运行时用枚举数值等价物。
 */
import type {
  CloseAction,
  ErrorAction,
  LanguageClientOptions,
} from 'vscode-languageclient';
import * as vscode from 'vscode';
import {
  LanguageClientWrapper,
  type LanguageClientConfig,
} from 'monaco-languageclient/lcwrapper';
import { getLanguageRegistration, type EditorLanguage } from '../languages/registry.js';

/** 与 vscode-languageclient `ErrorAction` / `CloseAction` 枚举值一致（browser 与 node 相同）。 */
const ERROR_CONTINUE = 1 as ErrorAction;
const CLOSE_DO_NOT_RESTART = 1 as CloseAction;

function defaultErrorHandling(): LanguageClientOptions['errorHandler'] {
  return {
    error: () => ({
      action: ERROR_CONTINUE,
    }),
    closed: () => ({
      action: CLOSE_DO_NOT_RESTART,
    }),
  };
}

export function createLanguageClientConfig(
  language: EditorLanguage,
  webSocketUrl: string,
): LanguageClientConfig {
  const reg = getLanguageRegistration(language);
  const clientOptions: LanguageClientOptions = {
    documentSelector: [reg.monacoLanguageId],
    workspaceFolder: {
      index: 0,
      name: 'workspace',
      uri: vscode.Uri.file('/workspace'),
    },
    errorHandler: defaultErrorHandling(),
    markdown: {
      isTrusted: true,
    },
  };

  return {
    languageId: reg.monacoLanguageId,
    connection: {
      options: {
        $type: 'WebSocketUrl',
        url: webSocketUrl,
      },
    },
    clientOptions,
  };
}

export function startLanguageClient(config: LanguageClientConfig): Promise<LanguageClientWrapper> {
  const wrapper = new LanguageClientWrapper(config);
  return wrapper.start().then(() => wrapper);
}

export async function disposeLanguageClient(wrapper: LanguageClientWrapper | undefined): Promise<void> {
  if (!wrapper) {
    return;
  }
  await wrapper.dispose(true);
}
