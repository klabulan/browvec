/**
 * Database Types for sql.js Compatibility
 * 
 * This file defines types and interfaces that provide sql.js API compatibility
 * while working with the LocalRetrieve Worker infrastructure.
 */

import type { SQLValue, SQLParams, SearchRequest, SearchResponse } from './worker.js';

// sql.js compatible types
export type { SQLValue, SQLParams };

// Statement execution results
export interface StatementResult {
  columns: string[];
  values: SQLValue[][];
}

// Database execution options
export interface ExecOptions {
  sql: string;
  bind?: SQLParams;
}

// Statement binding options  
export interface BindOptions {
  [key: string]: SQLValue;
}

// Database configuration
export interface DatabaseConfig {
  filename?: string;
  vfs?: 'opfs' | 'opfs-sahpool';
  pragmas?: Record<string, string>;
  workerUrl?: string;
  workerConfig?: {
    maxConcurrentOperations?: number;
    operationTimeout?: number;
    enablePerformanceMonitoring?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

// sql.js compatible Database interface
export interface DatabaseAPI {
  // Core sql.js methods
  exec(sql: string | ExecOptions): StatementResult[];
  run(sql: string, params?: SQLParams): DatabaseAPI;
  prepare(sql: string): StatementAPI;
  export(): Uint8Array;
  close(): void;

  // Additional LocalRetrieve methods
  search?(request: SearchRequest): Promise<SearchResponse>;
  initializeSchema?(): Promise<void>;
  
  // Static creation method
  // static create(buffer?: Uint8Array, filename?: string): Promise<DatabaseAPI>;
}

// sql.js compatible Statement interface
export interface StatementAPI {
  // Core statement methods
  bind(params?: SQLParams): StatementAPI;
  step(): boolean;
  get(): SQLValue[];
  getAsObject(): Record<string, SQLValue>;
  getColumnNames(): string[];
  reset(): StatementAPI;
  free(): void;

  // Statement state
  readonly finalized: boolean;
}

// Internal types for implementation
export interface DatabaseState {
  isOpen: boolean;
  filename: string;
  worker: Worker | null;
  workerRPC: any; // WorkerRPC instance
}

export interface StatementState {
  sql: string;
  bound: boolean;
  stepped: boolean;
  finished: boolean;
  currentRow: Record<string, SQLValue> | null;
  columns: string[];
  database: DatabaseAPI;
}

// Error types
export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class StatementError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'StatementError';
  }
}

// Utility types for type checking
export function isStatementResult(obj: any): obj is StatementResult {
  return obj && 
    typeof obj === 'object' && 
    Array.isArray(obj.columns) && 
    Array.isArray(obj.values);
}

export function isSQLValue(value: any): value is SQLValue {
  return value === null || 
    typeof value === 'number' || 
    typeof value === 'string' || 
    value instanceof Uint8Array;
}

// Configuration defaults
export const DEFAULT_DATABASE_CONFIG: Required<Omit<DatabaseConfig, 'filename' | 'workerUrl'>> = {
  vfs: 'opfs',
  pragmas: {
    synchronous: 'NORMAL',
    cache_size: '-64000', // 64MB cache
    temp_store: 'MEMORY'
  },
  workerConfig: {
    maxConcurrentOperations: 10,
    operationTimeout: 30000,
    enablePerformanceMonitoring: true,
    logLevel: 'info'
  }
};

// Worker URL resolution
export function resolveWorkerUrl(workerUrl?: string): string {
  if (workerUrl) {
    return workerUrl;
  }
  
  // Default worker URL - relative to the current module
  return new URL(/* @vite-ignore */ '../database/worker.js', import.meta.url).toString();
}

// Validation utilities
export function validateSQLParams(params: any): params is SQLParams {
  if (!params) return true;
  
  if (Array.isArray(params)) {
    return params.every(isSQLValue);
  }
  
  if (typeof params === 'object') {
    return Object.values(params).every(isSQLValue);
  }
  
  return false;
}

export function validateSQL(sql: any): sql is string {
  return typeof sql === 'string' && sql.trim().length > 0;
}