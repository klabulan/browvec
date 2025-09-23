/**
 * Complete sql.js Type Definitions for LocalRetrieve
 * 
 * This file provides complete sql.js API compatibility types while working
 * with the LocalRetrieve Worker infrastructure. It includes both synchronous
 * and asynchronous API variants.
 */

export type SQLValue = number | string | Uint8Array | null;
export type SQLParams = SQLValue[] | { [key: string]: SQLValue };

// sql.js QueryExecResult interface
export interface QueryExecResult {
  columns: string[];
  values: SQLValue[][];
}

// sql.js Statement execution result
export interface StatementExecResult {
  columns: string[];
  values: SQLValue[][];
}

// sql.js Database interface (complete compatibility)
export interface SQLDatabase {
  // Core sql.js synchronous methods
  exec(sql: string): QueryExecResult[];
  run(sql: string, params?: SQLParams): SQLDatabase;
  prepare(sql: string): SQLStatement;
  export(): Uint8Array;
  close(): void;
  
  // sql.js utility methods
  getRowsModified(): number;
  savepoint(name?: string): void;
  savepoint_release(name?: string): void;
  savepoint_rollback(name?: string): void;
  
  // sql.js function registration (stubs for compatibility)
  create_function(name: string, func: (...args: any[]) => any): void;
  create_aggregate(name: string, funcs: { step: Function; finalize: Function }): void;
  
  // LocalRetrieve async extensions (enhanced API)
  execAsync?(sql: string): Promise<QueryExecResult[]>;
  runAsync?(sql: string, params?: SQLParams): Promise<SQLDatabase>;
  prepareAsync?(sql: string): Promise<SQLStatement>;
  exportAsync?(): Promise<Uint8Array>;
  closeAsync?(): Promise<void>;
  
  // LocalRetrieve specific extensions
  search?(request: any): Promise<any>;
  initializeSchema?(): Promise<void>;
}

// sql.js Statement interface (complete compatibility)
export interface SQLStatement {
  // Core sql.js synchronous methods
  bind(params?: SQLParams): boolean;
  step(): boolean;
  get(): SQLValue[];
  getAsObject(): { [column: string]: SQLValue };
  getColumnNames(): string[];
  reset(): boolean;
  free(): boolean;
  
  // sql.js statement properties
  readonly sql: string;
  readonly finalized: boolean;
  
  // LocalRetrieve async extensions
  bindAsync?(params?: SQLParams): Promise<boolean>;
  stepAsync?(): Promise<boolean>;
  getAsync?(): Promise<SQLValue[]>;
  getAsObjectAsync?(): Promise<{ [column: string]: SQLValue }>;
  resetAsync?(): Promise<boolean>;
  freeAsync?(): Promise<boolean>;
}

// sql.js Database creation options
export interface SQLDatabaseConfig {
  filename?: string;
  readOnly?: boolean;
  locateFile?: (filename: string) => string;
}

// sql.js Module interface (for static methods)
export interface SQLModule {
  Database: {
    new(data?: Uint8Array, params?: SQLDatabaseConfig): SQLDatabase;
    call(thisArg: any, data?: Uint8Array, params?: SQLDatabaseConfig): SQLDatabase;
  };
  Statement: {
    new(database: SQLDatabase, sql: string): SQLStatement;
  };
}

// Enhanced error types for sql.js compatibility
export class SQLError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'SQLError';
  }
}

export class SQLStatementError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'SQLStatementError';
  }
}

export class SQLDatabaseError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'SQLDatabaseError';
  }
}

export class SQLSyntaxError extends SQLError {
  constructor(message: string, public sqlText?: string, public position?: number) {
    super(`SQL Syntax Error: ${message}`);
    this.name = 'SQLSyntaxError';
    this.code = 1; // SQLITE_ERROR
  }
}

export class SQLConstraintError extends SQLError {
  constructor(message: string, public constraintType?: string) {
    super(`Constraint Error: ${message}`);
    this.name = 'SQLConstraintError';
    this.code = 19; // SQLITE_CONSTRAINT
  }
}

export class SQLNotFoundError extends SQLError {
  constructor(message: string, public objectName?: string) {
    super(`Not Found: ${message}`);
    this.name = 'SQLNotFoundError';
    this.code = 0; // No specific SQLite code
  }
}

export class SQLBusyError extends SQLError {
  constructor(message: string = 'Database is locked') {
    super(message);
    this.name = 'SQLBusyError';
    this.code = 5; // SQLITE_BUSY
  }
}

export class SQLTimeoutError extends SQLError {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'SQLTimeoutError';
    this.code = -1; // Custom timeout code
  }
}

export class SQLCompatibilityError extends SQLError {
  constructor(message: string, public compatibilityLevel?: string) {
    super(`Compatibility Issue: ${message}`);
    this.name = 'SQLCompatibilityError';
    this.code = -2; // Custom compatibility code
  }
}

// Error code mapping for sql.js compatibility
export const SQL_ERROR_CODES = {
  SQLITE_OK: 0,
  SQLITE_ERROR: 1,
  SQLITE_INTERNAL: 2,
  SQLITE_PERM: 3,
  SQLITE_ABORT: 4,
  SQLITE_BUSY: 5,
  SQLITE_LOCKED: 6,
  SQLITE_NOMEM: 7,
  SQLITE_READONLY: 8,
  SQLITE_INTERRUPT: 9,
  SQLITE_IOERR: 10,
  SQLITE_CORRUPT: 11,
  SQLITE_NOTFOUND: 12,
  SQLITE_FULL: 13,
  SQLITE_CANTOPEN: 14,
  SQLITE_PROTOCOL: 15,
  SQLITE_EMPTY: 16,
  SQLITE_SCHEMA: 17,
  SQLITE_TOOBIG: 18,
  SQLITE_CONSTRAINT: 19,
  SQLITE_MISMATCH: 20,
  SQLITE_MISUSE: 21,
  SQLITE_NOLFS: 22,
  SQLITE_AUTH: 23,
  SQLITE_FORMAT: 24,
  SQLITE_RANGE: 25,
  SQLITE_NOTADB: 26,
  SQLITE_NOTICE: 27,
  SQLITE_WARNING: 28,
  SQLITE_ROW: 100,
  SQLITE_DONE: 101,
} as const;

// Error handling utilities
export function mapSQLiteError(code: number, message: string): SQLError {
  switch (code) {
    case SQL_ERROR_CODES.SQLITE_ERROR:
      return new SQLSyntaxError(message);
    case SQL_ERROR_CODES.SQLITE_CONSTRAINT:
      return new SQLConstraintError(message);
    case SQL_ERROR_CODES.SQLITE_BUSY:
    case SQL_ERROR_CODES.SQLITE_LOCKED:
      return new SQLBusyError(message);
    case SQL_ERROR_CODES.SQLITE_NOTFOUND:
      return new SQLNotFoundError(message);
    default:
      return new SQLError(message, code);
  }
}

export function createCompatibilityError(operation: string, reason: string): SQLCompatibilityError {
  return new SQLCompatibilityError(
    `Operation '${operation}' has limitations: ${reason}\n` +
    'Consider using async API for full functionality.'
  );
}

// sql.js compatibility utility functions
export function isSQLValue(value: any): value is SQLValue {
  return value === null || 
    typeof value === 'number' || 
    typeof value === 'string' || 
    value instanceof Uint8Array;
}

export function isSQLParams(params: any): params is SQLParams {
  if (!params) return true;
  
  if (Array.isArray(params)) {
    return params.every(isSQLValue);
  }
  
  if (typeof params === 'object' && params !== null) {
    return Object.values(params).every(isSQLValue);
  }
  
  return false;
}

export function validateSQL(sql: any): sql is string {
  return typeof sql === 'string' && sql.trim().length > 0;
}

// sql.js result transformation utilities
export function transformToSQLResult(rows: any[]): QueryExecResult {
  if (!rows || rows.length === 0) {
    return { columns: [], values: [] };
  }
  
  const firstRow = rows[0];
  const columns = Object.keys(firstRow);
  const values = rows.map(row => columns.map(col => row[col] ?? null));
  
  return { columns, values };
}

export function transformFromSQLParams(params?: SQLParams): { [key: string]: SQLValue } | SQLValue[] | undefined {
  if (!params) return undefined;
  if (Array.isArray(params)) return params;
  return params;
}

// Compatibility constants
export const SQL_OPEN_READONLY = 0x00000001;
export const SQL_OPEN_READWRITE = 0x00000002;
export const SQL_OPEN_CREATE = 0x00000004;
export const SQL_OPEN_DELETEONCLOSE = 0x00000008;
export const SQL_OPEN_EXCLUSIVE = 0x00000010;
export const SQL_OPEN_AUTOPROXY = 0x00000020;
export const SQL_OPEN_URI = 0x00000040;
export const SQL_OPEN_MEMORY = 0x00000080;

// sql.js Database factory interface for compatibility
export interface SQLDatabaseConstructor {
  new(data?: Uint8Array, params?: SQLDatabaseConfig): SQLDatabase;
  (data?: Uint8Array, params?: SQLDatabaseConfig): SQLDatabase;
}

// Re-export for module compatibility
export { SQLDatabase as Database, SQLStatement as Statement };

// Version information
export const SQL_VERSION = '1.8.0'; // sql.js compatibility version
export const LOCALRETRIEVE_VERSION = '1.0.0';
export const SQLITE_VERSION = '3.47.0';

// Feature flags for compatibility checking
export const FEATURES = {
  FTS5: true,
  JSON1: true,
  RTREE: true,
  VECTOR: true, // LocalRetrieve extension
  OPFS: true,   // LocalRetrieve extension
  ASYNC_API: true, // LocalRetrieve extension
} as const;

export type FeatureFlag = keyof typeof FEATURES;

// Compatibility mode enumeration
export enum CompatibilityMode {
  STRICT_SYNC = 'strict_sync',     // Strict sql.js synchronous compatibility (limited)
  ASYNC_PREFERRED = 'async_preferred', // Prefer async APIs, fallback to sync
  ASYNC_ONLY = 'async_only'        // Only async APIs available
}

// Configuration for sql.js compatibility layer
export interface SQLCompatConfig {
  mode: CompatibilityMode;
  enableWarnings: boolean;
  throwOnSyncLimitations: boolean;
  workerTimeout: number;
}

export const DEFAULT_SQL_COMPAT_CONFIG: SQLCompatConfig = {
  mode: CompatibilityMode.ASYNC_PREFERRED,
  enableWarnings: true,
  throwOnSyncLimitations: false,
  workerTimeout: 30000
};