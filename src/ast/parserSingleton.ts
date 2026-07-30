import { Parser } from '@/ast';

let parserPromise: Promise<Parser> | null = null;

/** Shared tree-sitter SQL parser (lazy-loaded once). */
export function getSqlParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = Parser.load();
  }
  return parserPromise;
}
