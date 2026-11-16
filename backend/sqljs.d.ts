declare module 'sql.js' {
  export interface Statement {
    bind(params?: Array<string | number | null | Uint8Array>): boolean;
    run(params?: Array<string | number | null | Uint8Array>): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }

  export interface Database {
    run(sql: string, params?: Array<string | number | null | Uint8Array>): Database;
    prepare(sql: string): Statement;
  }

  export interface SqlJsStatic {
    Database: new () => Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string, prefix: string) => string;
  }): Promise<SqlJsStatic>;
}
