import SQLLanguageWASM from '@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm?url';
import { Parser as _Parser, Language, Query } from 'web-tree-sitter';

const CORE_WASM_PATH = 'node_modules/web-tree-sitter/tree-sitter.wasm';
const SQL_WASM_PATH =
  'node_modules/@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm';

export class Parser extends _Parser {
  constructor() {
    super();
  }

  query(source: string) {
    return new Query(Sql, source);
  }
}

await Parser.init({
  // Optional: Configure locator if WASM files aren't in the default location
  locateFile(scriptName: string, scriptDirectory: string) {
    console.log('Locate File:', scriptName, scriptDirectory);
    if (import.meta.env.DEV) {
      return CORE_WASM_PATH;
    }
    return 'tree-sitter.wasm';
  },
});

const parser = new Parser();

const Sql = await Language.load(SQLLanguageWASM);
parser.setLanguage(Sql);

export default parser;
