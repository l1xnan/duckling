import SQLLanguageWASM from '@l1xnan/tree-sitter-sql/tree-sitter-sql.wasm?url';
import { Parser as _Parser, Language, Query } from 'web-tree-sitter';

let Sql: Language;

export class Parser extends _Parser {
  constructor() {
    super();
  }

  query(source: string) {
    return new Query(Sql, source);
  }

  static async init() {
    await _Parser.init({});
  }

  static async load(lang?: string) {
    await Parser.init();
    const parser = new Parser();
    Sql = await Language.load(lang ?? SQLLanguageWASM);
    parser.setLanguage(Sql);
    return parser;
  }
}
