import SQLLanguageWASM from '@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm?url';
import { Parser as _Parser, Language, Query } from 'web-tree-sitter';

const CORE_WASM_PATH = 'node_modules/web-tree-sitter/tree-sitter.wasm';

let Sql: Language;

export class Parser extends _Parser {
  constructor() {
    super();
  }

  query(source: string) {
    return new Query(Sql, source);
  }

  static async init() {
    await _Parser.init({
      // Optional: Configure locator if WASM files aren't in the default location
      locateFile(scriptName: string, scriptDirectory: string) {
        console.log('Locate File:', scriptName, scriptDirectory);
        if (import.meta.env.DEV) {
          return CORE_WASM_PATH;
        }
        return scriptName; //'tree-sitter.wasm';
      },
    });
  }

  static async load(lang?: string) {
    await Parser.init();
    const parser = new Parser();
    Sql = await Language.load(lang ?? SQLLanguageWASM);
    parser.setLanguage(Sql);
    return parser;
  }
}
