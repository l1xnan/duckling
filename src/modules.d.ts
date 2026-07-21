// Type declarations for modules without bundled types

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor';
}

declare module 'monaco-sql-languages' {
  export function setupLanguageFeatures(...args: any[]): void;
  export enum LanguageIdEnum {
    FLINK = 'flink',
    HIVE = 'hive',
    MYSQL = 'mysql',
    PG = 'pgsql',
    PGSQL = 'pgsql',
    SPARK = 'spark',
    IMPALA = 'impala',
    TRINO = 'trino',
  }
}

declare module 'monaco-sql-languages/esm/_.contribution' {
  export function registerLanguage(...args: any[]): void;
}

declare module 'monaco-sql-languages/esm/common/constants' {
  export const languageId: string;
  export const TokenClassConsts: Record<string, string>;
}

declare module 'monaco-sql-languages/esm/setupLanguageFeatures' {
  export function setupLanguageFeatures(...args: any[]): void;
}

declare module 'monaco-sql-languages/esm/fillers/monaco-editor-core' {
  export * from 'monaco-editor';
}

declare module 'monaco-sql-languages/esm/baseSQLWorker' {
  export class BaseSQLWorker {
    constructor(...args: any[]);
  }
  export interface ICreateData {
    languageId: string;
  }
}

declare module 'dt-sql-parser/dist/parser/postgresql' {
  const parser: any;
  export default parser;
}

// Wildcard declarations for monaco-sql-languages
declare module 'monaco-sql-languages/esm/languages/*' {}
declare module 'monaco-sql-languages/esm/languages/*/flink.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/hive.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/impala.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/mysql.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/pgsql.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/spark.contribution' {}
declare module 'monaco-sql-languages/esm/languages/*/trino.contribution' {}

// Worker imports (Vite ?worker suffix)
declare module 'monaco-sql-languages/esm/languages/flink/flink.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/hive/hive.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/impala/impala.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/mysql/mysql.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/spark/spark.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
declare module 'monaco-sql-languages/esm/languages/trino/trino.worker?worker' {
  const WorkerFactory: { new (): Worker };
  export default WorkerFactory;
}
