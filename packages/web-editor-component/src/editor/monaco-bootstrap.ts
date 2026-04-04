import './standalone-language-contributions.js';

import { LogLevel } from '@codingame/monaco-vscode-api';
import type { ILogger } from '@codingame/monaco-vscode-log-service-override';
import getViewsServiceOverride from '@codingame/monaco-vscode-views-service-override';
import {
  MonacoVscodeApiWrapper,
  type MonacoVscodeApiConfig,
  useOpenEditorStub,
} from 'monaco-languageclient/vscodeApiWrapper';
import { defineDefaultWorkerLoaders, useWorkerFactory } from 'monaco-languageclient/workerFactory';
import { registerVirtualWorkspaceOverlay } from './virtual-workspace.js';

let apiSingleton: MonacoVscodeApiWrapper | null = null;
let startPromise: Promise<MonacoVscodeApiWrapper> | null = null;

/**
 * Classic worker setup from TypeFox examples: TextMate worker is incompatible with classic mode.
 */
export function configureClassicWorkerFactory(logger?: ILogger): void {
  const workerLoaders = defineDefaultWorkerLoaders();
  workerLoaders.TextMateWorker = undefined;
  workerLoaders.extensionHostWorkerMain = undefined;
  useWorkerFactory({
    workerLoaders,
    logger,
  });
}

function buildClassicApiConfig(): MonacoVscodeApiConfig {
  return {
    $type: 'classic',
    viewsConfig: {
      $type: 'EditorService',
    },
    serviceOverrides: {
      ...getViewsServiceOverride(useOpenEditorStub),
    },
    logLevel: LogLevel.Off,
    userConfiguration: {
      json: JSON.stringify({
        'editor.experimental.asyncTokenization': true,
        'editor.quickSuggestions': { other: true, comments: false, strings: true },
        'editor.wordBasedSuggestions': 'off',
      }),
    },
    monacoWorkerFactory: configureClassicWorkerFactory,
    /**
     * Default extension host pulls in workbench code that expects Views services (`getViewContainersByLocation`).
     * Classic editor-only apps do not register those overrides — disable extension services.
     */
    advanced: {
      loadExtensionServices: false,
      loadThemes: false,
      enableExtHostWorker: false,
    },
  };
}

/**
 * monaco-vscode-api initializes only once per page. All `<code-editor>` instances share this wrapper.
 */
export function ensureMonacoVscodeApi(): Promise<MonacoVscodeApiWrapper> {
  if (startPromise) {
    return startPromise;
  }
  startPromise = (async () => {
    await registerVirtualWorkspaceOverlay();
    apiSingleton = new MonacoVscodeApiWrapper(buildClassicApiConfig());
    await apiSingleton.start({
      caller: '@web-editor/component',
      performServiceConsistencyChecks: false,
    });
    if (!apiSingleton) {
      throw new Error('MonacoVscodeApiWrapper missing after start');
    }
    return apiSingleton;
  })();
  return startPromise;
}
