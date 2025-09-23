/**
 * LocalRetrieve SDK - Main Export
 * 
 * Provides sql.js compatible Database interface with LocalRetrieve
 * hybrid search capabilities built on SQLite WASM + sqlite-vec.
 */

// Core Database exports
export { Database } from './database/Database.js';
export { Statement } from './database/Statement.js';

// Import classes for internal use (with different names to avoid conflicts)
import { Database as DatabaseClass } from './database/Database.js';
import { Statement as StatementClass } from './database/Statement.js';

// Type exports for external usage
export type {
  DatabaseAPI,
  StatementAPI,
  DatabaseConfig,
  SQLValue,
  SQLParams,
  StatementResult,
  ExecOptions,
  BindOptions
} from './types/database.js';

// Import types for internal use
import type { DatabaseAPI, StatementAPI, DatabaseConfig } from './types/database.js';

export type {
  SearchRequest,
  SearchResponse,
  SearchQuery,
  SearchResult,
  CollectionInfo,
  WorkerConfig
} from './types/worker.js';

// Utility exports
export {
  DatabaseError,
  StatementError,
  DEFAULT_DATABASE_CONFIG,
  resolveWorkerUrl,
  validateSQL,
  validateSQLParams,
  isStatementResult,
  isSQLValue
} from './types/database.js';

export {
  WorkerError,
  DatabaseError as WorkerDatabaseError,
  VectorError,
  OPFSError
} from './types/worker.js';

// Worker utilities (for advanced usage)
export { WorkerRPC, createWorkerRPC } from './utils/rpc.js';

// Version information
export const VERSION = '1.0.0-mvp';
export const FEATURES = [
  'sql.js-compatibility',
  'opfs-persistence', 
  'hybrid-search',
  'sqlite-vec',
  'fts5',
  'worker-based'
] as const;

/**
 * Initialize LocalRetrieve with a database file
 * 
 * @param filename Database filename (use 'opfs:/path/to/file.db' for OPFS persistence)
 * @param config Optional configuration
 * @returns Promise<Database> Ready-to-use database instance
 * 
 * @example
 * ```typescript
 * import { initLocalRetrieve } from 'localretrieve';
 * 
 * // Initialize with OPFS persistence
 * const db = await initLocalRetrieve('opfs:/myapp/search.db');
 * 
 * // Initialize schema for hybrid search
 * await db.initializeSchema();
 * 
 * // Use sql.js compatible API
 * db.run('INSERT INTO docs_default (id, content) VALUES (?, ?)', ['doc1', 'hello world']);
 * 
 * // Or use hybrid search
 * const results = await db.search({
 *   query: { text: 'hello', vector: myVector },
 *   limit: 10
 * });
 * ```
 */
export async function initLocalRetrieve(
  filename: string = 'opfs:/localretrieve/default.db',
  config?: Partial<DatabaseConfig>
): Promise<DatabaseClass> {
  const finalConfig: DatabaseConfig = {
    ...config,
    filename
  };

  const db = await DatabaseClass.create(undefined, filename);
  
  // Initialize schema only if needed (the schema check handles existence)
  try {
    await db.initializeSchema();
  } catch (error) {
    // Schema initialization failed - this might indicate a more serious issue
    console.error('Schema initialization failed:', error);
    throw error;
  }

  return db;
}

/**
 * Create a new Database instance (sql.js compatibility)
 * 
 * @param buffer Optional buffer to import
 * @param filename Optional filename for persistence
 * @returns Promise<Database> Database instance
 */
export async function createDatabase(
  buffer?: Uint8Array,
  filename: string = ':memory:'
): Promise<DatabaseClass> {
  return DatabaseClass.create(buffer, filename);
}

// Re-export main Database class as default for convenience
export { DatabaseClass as default };

// SQL.js compatibility namespace
export namespace SQL {
  export const Database = DatabaseClass;
  export type Database = DatabaseAPI;
  export const Statement = StatementClass;
  export type Statement = StatementAPI;
}