import { LogLevel } from '@codingame/monaco-vscode-api';
import type { ILogger } from '@codingame/monaco-vscode-log-service-override';
import {
  MonacoVscodeApiWrapper,
  type MonacoVscodeApiConfig,
} from 'monaco-languageclient/vscodeApiWrapper';
import { defineDefaultWorkerLoaders, useWorkerFactory } from 'monaco-languageclient/workerFactory';

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
    logLevel: LogLevel.Off,
    userConfiguration: {
      json: JSON.stringify({
        'editor.experimental.asyncTokenization': true,
        'editor.quickSuggestions': { other: true, comments: false, strings: true },
        'editor.wordBasedSuggestions': 'off',
      }),
    },
    monacoWorkerFactory: configureClassicWorkerFactory,
  };
}

/**
 * monaco-vscode-api initializes only once per page. All `<code-editor>` instances share this wrapper.
 */
export function ensureMonacoVscodeApi(): Promise<MonacoVscodeApiWrapper> {
  if (startPromise) {
    return startPromise;
  }
  apiSingleton = new MonacoVscodeApiWrapper(buildClassicApiConfig());
  startPromise = apiSingleton
    .start({
      caller: '@web-editor/component',
      performServiceConsistencyChecks: true,
    })
    .then(() => {
      if (!apiSingleton) {
        throw new Error('MonacoVscodeApiWrapper missing after start');
      }
      return apiSingleton;
    });
  return startPromise;
}
