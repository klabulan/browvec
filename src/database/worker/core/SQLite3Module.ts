/**
 * SQLite3Module Interface
 *
 * Type definitions for the SQLite WASM C API module.
 * This interface defines all the low-level SQLite functions and utilities
 * available through the WASM module.
 */

/**
 * SQLite WASM module interface (C API)
 *
 * This interface provides access to the raw SQLite C API through WASM.
 * All functions are direct mappings to the SQLite C API with WASM-specific
 * memory management patterns.
 */
export interface SQLite3Module {
  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;

  // String utilities
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  UTF8ToString(ptr: number): string;

  // Value getters/setters
  getValue(ptr: number, type: string): number;
  setValue(ptr: number, value: number, type: string): void;

  // Bulk memory operations
  writeArrayToMemory?(data: Uint8Array, ptr: number): void;

  // SQLite C API functions
  _sqlite3_open(filename: number, ppDb: number): number;
  _sqlite3_close(db: number): number;
  _sqlite3_exec(db: number, sql: number, callback: number, arg: number, errmsg: number): number;
  _sqlite3_prepare_v2(db: number, sql: number, nByte: number, ppStmt: number, pzTail: number): number;
  _sqlite3_step(stmt: number): number;
  _sqlite3_finalize(stmt: number): number;
  _sqlite3_column_count(stmt: number): number;
  _sqlite3_column_name(stmt: number, iCol: number): number;
  _sqlite3_column_type(stmt: number, iCol: number): number;
  _sqlite3_column_int(stmt: number, iCol: number): number;
  _sqlite3_column_double(stmt: number, iCol: number): number;
  _sqlite3_column_text(stmt: number, iCol: number): number;
  _sqlite3_column_blob(stmt: number, iCol: number): number;
  _sqlite3_column_bytes(stmt: number, iCol: number): number;
  _sqlite3_bind_int(stmt: number, index: number, value: number): number;
  _sqlite3_bind_double(stmt: number, index: number, value: number): number;
  _sqlite3_bind_text(stmt: number, index: number, value: number, length: number, destructor: number): number;
  _sqlite3_bind_blob(stmt: number, index: number, value: number, length: number, destructor: number): number;
  _sqlite3_bind_null(stmt: number, index: number): number;
  _sqlite3_errmsg(db: number): number;
  _sqlite3_libversion(): number;

  // sqlite-vec extension functions
  _sqlite3_vec_init_manual(db: number): number;

  // Serialize/deserialize functions
  _sqlite3_serialize(db: number, schema: number, size: number, flags: number): number;
  _sqlite3_deserialize(db: number, schema: number, data: number, szDb: bigint, szBuf: bigint, flags: number): number;

  // Version info
  version?: string;
}

// SQLite result codes
export const SQLITE_OK = 0;
export const SQLITE_ROW = 100;
export const SQLITE_DONE = 101;

// SQLite column types
export const SQLITE_INTEGER = 1;
export const SQLITE_FLOAT = 2;
export const SQLITE_TEXT = 3;
export const SQLITE_BLOB = 4;
export const SQLITE_NULL = 5;

// SQLite bind destructor constants
export const SQLITE_STATIC = 0;
export const SQLITE_TRANSIENT = -1;