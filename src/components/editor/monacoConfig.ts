// monacoConfig.js
import { CompleteMetaType } from '@/ast/analyze';
import { handleProvideCompletionItems } from '@/components/editor/completion';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Central Registry: Map<modelUri: string, completionFunction | completionItems[]>
// Using a function allows for more dynamic completions based on position/context
export const completionRegistry = new Map<string, CompleteMetaType>();

const globalProviderDisposable: Record<string, monaco.IDisposable> = {};

// Function to register the single global provider for a given language
// We make it accept languageId so it can be reused (e.g., 'sql', 'javascript')
export function registerUriBasedCompletionProvider(languageId: string) {
  // Dispose previous provider for this languageId if re-registering (optional, usually run once)
  if (globalProviderDisposable[languageId]) {
    console.warn(
      `Disposing existing provider for ${languageId} before re-registering.`,
    );
    globalProviderDisposable[languageId].dispose();
  }

  console.log(
    `Registering URI-based GLOBAL completion provider for language: ${languageId}`,
  );

  const disposable = monaco.languages.registerCompletionItemProvider(
    languageId,
    {
      triggerCharacters: ['.', ' ', '(', "'", '"', '\n'], // Add trigger characters as needed
      provideCompletionItems: (model, position, _context, _token) => {
        return handleProvideCompletionItems(model, position);
      },
    },
  );

  // Store the disposable for potential future cleanup
  globalProviderDisposable[languageId] = disposable;

  console.log(`Provider registered successfully for ${languageId}`);

  // Return the disposable in case the caller wants to manage it specifically
  return disposable;
}

// Function for components to register their completion logic/data
// Accepts either a static array or a function for dynamic calculation
export function setCompletionsForUri(
  modelUri: string,
  completeMeta: CompleteMetaType,
) {
  if (!modelUri) {
    console.error('Cannot set completions for a null or undefined URI.');
    return;
  }
  console.log(
    `Setting completion source for URI: ${modelUri}. Type: ${typeof completeMeta}`,
  );
  completionRegistry.set(modelUri, completeMeta);
}

// Function for components to clean up when they unmount or context changes
export function removeCompletionsForUri(modelUri: string) {
  if (!modelUri) {
    console.warn(
      'Attempted to remove completions for a null or undefined URI.',
    );
    return;
  }
  const deleted = completionRegistry.delete(modelUri);
  if (deleted) {
    console.log(`Removed completion source for URI: ${modelUri}`);
  } else {
    console.log(
      `Attempted to remove completion source for URI: ${modelUri}, but it was not found.`,
    );
  }
}

// Optional: Helper to create Monaco completion items
export function createCompletionItem(
  suggestion: Partial<monaco.languages.CompletionItem>,
) {
  // Basic example, adapt kinds and details as needed
  return {
    label: suggestion.label, // The label shown in the list
    kind: suggestion.kind || monaco.languages.CompletionItemKind.Text, // e.g., Keyword, Function, Variable
    insertText: suggestion.insertText || suggestion.label, // Text to insert
    detail: suggestion.detail, // Additional info shown on the side
    documentation: suggestion.documentation, // More detailed info on hover/expand
    range: suggestion.range || null, // Let Monaco determine the replacement range usually
    // ... other CompletionItem properties
  };
}
