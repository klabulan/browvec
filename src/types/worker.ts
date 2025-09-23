/**
 * Worker Types for LocalRetrieve Database Worker
 * 
 * This file defines the message types and interfaces for communication
 * between the main thread and the database worker via RPC.
 */

// Base SQL value types compatible with sql.js
export type SQLValue = number | string | Uint8Array | null;

// SQL parameter types
export type SQLParams = Record<string, SQLValue> | SQLValue[];

// Database operation result types
export interface QueryResult {
  rows: Record<string, any>[];
  rowsAffected?: number;
  lastInsertRowid?: number;
}

// Search-specific types
export interface SearchQuery {
  text?: string;
  vector?: Float32Array;
  filters?: Record<string, any>;
}

export interface SearchRequest {
  query: SearchQuery;
  collection?: string;
  limit?: number;
  fusionMethod?: 'rrf' | 'weighted';
  fusionWeights?: { fts: number; vec: number };
}

export interface SearchResult {
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  score: number;
  ftsScore?: number;
  vecScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
}

// Collection management types
export interface CollectionInfo {
  name: string;
  createdAt: number;
  schemaVersion: number;
  vectorDimensions: number;
  documentCount: number;
}

// Worker RPC message types
export interface WorkerMessage<T = any> {
  id: string;
  method: string;
  params?: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  result?: T;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

// Specific message types for each database operation
export interface OpenDatabaseParams {
  filename: string;
  vfs?: 'opfs' | 'opfs-sahpool';
  pragmas?: Record<string, string>;
}

export interface ExecParams {
  sql: string;
  params?: SQLParams;
}

export interface SelectParams {
  sql: string;
  params?: SQLParams;
}

export interface BulkInsertParams {
  table: string;
  rows: Record<string, any>[];
  batchSize?: number;
}

// Progress callback interface for export/import operations
export interface ExportImportProgress {
  phase: 'validating' | 'preparing' | 'exporting' | 'importing' | 'finalizing' | 'complete';
  bytesProcessed: number;
  totalBytes: number;
  timeElapsed: number;
}

export interface ExportParams {
  format?: 'sqlite' | 'json';
  includeSchema?: boolean;
  onProgress?: (progress: ExportImportProgress) => void;
}

export interface ImportParams {
  data: Uint8Array;
  format?: 'sqlite' | 'json';
  overwrite?: boolean;
  onProgress?: (progress: ExportImportProgress) => void;
}

// Database Worker API Interface
export interface DBWorkerAPI {
  // Core database operations
  open(params: OpenDatabaseParams): Promise<void>;
  close(): Promise<void>;
  exec(params: ExecParams): Promise<void>;
  select(params: SelectParams): Promise<QueryResult>;
  bulkInsert(params: BulkInsertParams): Promise<void>;
  
  // WASM-specific operations
  initVecExtension(): Promise<void>;
  
  // Schema management
  initializeSchema(): Promise<void>;
  getCollectionInfo(name: string): Promise<CollectionInfo>;
  
  // Search operations
  search(params: SearchRequest): Promise<SearchResponse>;
  
  // Data export/import
  export(params?: ExportParams): Promise<Uint8Array>;
  import(params: ImportParams): Promise<void>;
  clear(): Promise<void>;

  // Utility operations
  getVersion(): Promise<{ sqlite: string; vec: string; sdk: string }>;
  getStats(): Promise<{ memory: number; dbSize: number; operations: number }>;
}

// Worker method names (for type safety in RPC calls)
export type WorkerMethodName = keyof DBWorkerAPI;

// Worker events for notifications
export interface WorkerEvent<T = any> {
  type: string;
  data: T;
}

export interface DatabaseEvent extends WorkerEvent {
  type: 'database' | 'search' | 'error' | 'performance';
}

// Error types
export class WorkerError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class DatabaseError extends WorkerError {
  constructor(message: string, public sqliteCode?: number) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class VectorError extends WorkerError {
  constructor(message: string) {
    super(message, 'VECTOR_ERROR');
    this.name = 'VectorError';
  }
}

export class OPFSError extends WorkerError {
  constructor(message: string) {
    super(message, 'OPFS_ERROR');
    this.name = 'OPFSError';
  }
}

// Configuration types
export interface WorkerConfig {
  maxConcurrentOperations?: number;
  operationTimeout?: number;
  enablePerformanceMonitoring?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Performance monitoring types
export interface PerformanceMetrics {
  operationCount: number;
  averageLatency: number;
  memoryUsage: number;
  cacheHitRate: number;
  lastOperationTime: number;
}