import type { EditorAppConfig } from 'monaco-languageclient/editorApp';
import {
  getLanguageRegistration,
  type EditorLanguage,
  modelUriForInstance,
} from '../languages/registry.js';

export function createEditorAppConfig(
  language: EditorLanguage,
  instanceId: string,
  text: string,
): EditorAppConfig {
  const reg = getLanguageRegistration(language);
  const uri = modelUriForInstance(language, instanceId);
  const languageDef: EditorAppConfig['languageDef'] = {
    languageExtensionConfig: reg.languageExtensionConfig,
  };
  if (reg.monarchLanguage) {
    languageDef.monarchLanguage = reg.monarchLanguage;
  }
  return {
    codeResources: {
      modified: {
        text,
        uri,
        enforceLanguageId: reg.monacoLanguageId,
      },
    },
    languageDef,
    overrideAutomaticLayout: true,
    editorOptions: {
      automaticLayout: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
    },
  };
}
