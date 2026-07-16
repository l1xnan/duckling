// monacoConfig.js
import { CompleteMetaType } from '@/ast/analyze';
import { handleProvideCompletionItems } from '@/components/editor/completion';
import { formatSqlText } from '@/components/editor/sqlFormat';
import { DialectType } from '@/stores/dbList';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export const completionRegistry = new Map<string, CompleteMetaType>();
export const dialectRegistry = new Map<string, DialectType | undefined>();

const globalProviderDisposable: Record<string, monaco.IDisposable> = {};
const formatProviderDisposables: Record<string, monaco.IDisposable[]> = {};

function dialectForModel(model: monaco.editor.ITextModel) {
  return dialectRegistry.get(model.uri.toString());
}

export function registerUriBasedCompletionProvider(languageId: string) {
  if (globalProviderDisposable[languageId]) {
    return;
  }

  const disposable = monaco.languages.registerCompletionItemProvider(
    languageId,
    {
      triggerCharacters: ['.', ' ', '(', "'", '"', '`', '\n'],
      provideCompletionItems: (model, position, _context, _token) => {
        return handleProvideCompletionItems(model, position);
      },
    },
  );

  globalProviderDisposable[languageId] = disposable;
  return disposable;
}

export function registerSqlFormattingProvider(languageId = 'sql') {
  if (formatProviderDisposables[languageId]) {
    return;
  }

  const documentProvider =
    monaco.languages.registerDocumentFormattingEditProvider(languageId, {
      provideDocumentFormattingEdits(model) {
        try {
          const formatted = formatSqlText(model.getValue(), {
            dialect: dialectForModel(model),
          });
          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        } catch (error) {
          console.warn('SQL format failed:', error);
          return [];
        }
      },
    });

  const rangeProvider =
    monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
      provideDocumentRangeFormattingEdits(model, range) {
        try {
          const formatted = formatSqlText(model.getValueInRange(range), {
            dialect: dialectForModel(model),
          });
          return [
            {
              range,
              text: formatted,
            },
          ];
        } catch (error) {
          console.warn('SQL range format failed:', error);
          return [];
        }
      },
    });

  formatProviderDisposables[languageId] = [documentProvider, rangeProvider];
}

export function setCompletionsForUri(
  modelUri: string,
  completeMeta: CompleteMetaType,
) {
  if (!modelUri) {
    return;
  }
  completionRegistry.set(modelUri, completeMeta);
}

export function setDialectForUri(modelUri: string, dialect?: DialectType) {
  if (!modelUri) {
    return;
  }
  dialectRegistry.set(modelUri, dialect);
}

export function removeCompletionsForUri(modelUri: string) {
  if (!modelUri) {
    return;
  }
  completionRegistry.delete(modelUri);
  dialectRegistry.delete(modelUri);
}

export function createCompletionItem(
  suggestion: Partial<monaco.languages.CompletionItem>,
) {
  return {
    label: suggestion.label,
    kind: suggestion.kind || monaco.languages.CompletionItemKind.Text,
    insertText: suggestion.insertText || suggestion.label,
    detail: suggestion.detail,
    documentation: suggestion.documentation,
    range: suggestion.range || null,
  };
}
