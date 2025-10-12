/**
 * SQLiteManager
 *
 * Handles direct SQLite WASM operations, including database connection management,
 * SQL execution, and low-level WASM interactions.
 */

import type { SQLite3Module } from './SQLite3Module.js';
import {
  SQLITE_OK,
  SQLITE_ROW,
  SQLITE_DONE,
  SQLITE_INTEGER,
  SQLITE_FLOAT,
  SQLITE_TEXT,
  SQLITE_BLOB,
  SQLITE_NULL,
  SQLITE_TRANSIENT
} from './SQLite3Module.js';
import type { SQLValue, ExtendedSQLValue, SQLParams, ExtendedSQLParams, QueryResult } from '../../../types/worker.js';
import { DatabaseError, VectorError } from '../../../types/worker.js';

/**
 * SQLiteManager handles all direct SQLite WASM operations
 *
 * Responsibilities:
 * - WASM module loading and initialization
 * - Database connection management
 * - SQL statement preparation and execution
 * - Parameter binding and result extraction
 * - Memory management for WASM operations
 * - sqlite-vec extension initialization
 * - Database serialization/deserialization
 */
export class SQLiteManager {
  private sqlite3: SQLite3Module | null = null;
  private dbPtr: number = 0;
  private operationCount = 0;

  constructor(private logger?: { log: (level: string, message: string) => void }) {}

  /**
   * Load SQLite WASM module
   */
  async loadWASM(): Promise<void> {
    if (this.sqlite3) {
      return; // Already loaded
    }

    try {
      const sqlite3ModulePath = `../sqlite3.mjs`;
      this.log('info', `Loading SQLite WASM from: ${sqlite3ModulePath}`);

      const sqlite3Module = await import(sqlite3ModulePath);
      this.sqlite3 = await sqlite3Module.default();

      // Verify essential functions are available
      if (!this.sqlite3?._sqlite3_open || !this.sqlite3?._sqlite3_close) {
        throw new DatabaseError('SQLite WASM module is incomplete - missing core functions');
      }

      const versionPtr = this.sqlite3?._sqlite3_libversion();
      const version = versionPtr && this.sqlite3?.UTF8ToString ? this.sqlite3.UTF8ToString(versionPtr) : 'unknown';
      this.log('info', `SQLite WASM loaded successfully, version: ${version}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Failed to load SQLite WASM: ${message}`);
      throw new DatabaseError(`Failed to load SQLite WASM: ${message}`);
    }
  }

  /**
   * Open database connection
   */
  async openDatabase(dbPath: string): Promise<void> {
    if (!this.sqlite3) {
      await this.loadWASM();
    }

    if (this.dbPtr) {
      this.closeDatabase();
    }

    const filenamePtr = this.sqlite3!._malloc(dbPath.length + 1);
    this.sqlite3!.stringToUTF8(dbPath, filenamePtr, dbPath.length + 1);

    const dbPtrPtr = this.sqlite3!._malloc(4); // Pointer to pointer
    const result = this.sqlite3!._sqlite3_open(filenamePtr, dbPtrPtr);

    this.sqlite3!._free(filenamePtr);

    if (result !== SQLITE_OK) {
      this.sqlite3!._free(dbPtrPtr);
      const errorPtr = (this.sqlite3!._sqlite3_errmsg && this.sqlite3!._sqlite3_errmsg(0)) || 0;
      const errorMsg = errorPtr ? this.sqlite3!.UTF8ToString(errorPtr) : `SQLite error code ${result}`;
      throw new DatabaseError(`Failed to open database: ${errorMsg}`);
    }

    // Get the database pointer
    this.dbPtr = this.sqlite3!.getValue(dbPtrPtr, 'i32');
    this.sqlite3!._free(dbPtrPtr);

    if (!this.dbPtr) {
      throw new DatabaseError('Failed to get valid database pointer');
    }

    this.log('info', `Database opened successfully: ${dbPath}`);
  }

  /**
   * Close database connection
   */
  closeDatabase(): void {
    if (!this.sqlite3 || !this.dbPtr) {
      return;
    }

    try {
      this.sqlite3._sqlite3_close(this.dbPtr);
      this.dbPtr = 0;
      this.log('info', 'Database closed successfully');
    } catch (error) {
      this.log('error', `Error closing database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize sqlite-vec extension
   */
  async initVecExtension(): Promise<void> {
    if (!this.sqlite3 || !this.dbPtr) {
      throw new DatabaseError('Database not initialized');
    }

    if (!this.sqlite3._sqlite3_vec_init_manual) {
      throw new VectorError('sqlite-vec extension not available');
    }

    const result = this.sqlite3._sqlite3_vec_init_manual(this.dbPtr);
    if (result !== SQLITE_OK) {
      this.log('error', `sqlite-vec initialization failed with code: ${result}`);
      throw new VectorError(`Failed to initialize sqlite-vec extension (code: ${result})`);
    }

    this.log('info', 'sqlite-vec extension initialized successfully');

    // Test the extension with a simple query (using JSON string syntax)
    try {
      const testResults = await this.select("SELECT vec_f32('[1.0, 2.0, 3.0]') as test_vector");
      this.log('info', `vec_f32 function test result: ${JSON.stringify(testResults.rows[0])}`);
    } catch (error) {
      this.log('warn', `vec_f32 test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute SQL statement with optional parameters
   */
  async exec(sql: string, params?: ExtendedSQLParams): Promise<void> {
    if (!this.sqlite3 || !this.dbPtr) {
      throw new DatabaseError('Database not initialized');
    }

    this.operationCount++;

    // Special logging for transaction commands
    const sqlTrimmed = sql.trim().toUpperCase();
    const isTransactionCmd = sqlTrimmed.startsWith('BEGIN') ||
                            sqlTrimmed.startsWith('COMMIT') ||
                            sqlTrimmed.startsWith('ROLLBACK');

    if (isTransactionCmd) {
      this.log('info', `[SQLExec] Executing transaction command: ${sql}`);
    } else {
      this.log('debug', `[SQLExec] Executing: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
    }

    // If no parameters, use simple exec
    if (!params || params.length === 0) {
      const sqlPtr = this.sqlite3._malloc(sql.length + 1);
      this.sqlite3.stringToUTF8(sql, sqlPtr, sql.length + 1);

      const result = this.sqlite3._sqlite3_exec(this.dbPtr, sqlPtr, 0, 0, 0);
      this.sqlite3._free(sqlPtr);

      if (result !== SQLITE_OK) {
        const errorPtr = this.sqlite3._sqlite3_errmsg(this.dbPtr);
        const errorMsg = this.sqlite3.UTF8ToString(errorPtr);
        this.log('error', `[SQLExec] SQL execution failed: ${sql} - Error: ${errorMsg}`);
        throw new DatabaseError(`SQL execution failed: ${errorMsg}`);
      } else {
        if (isTransactionCmd) {
          this.log('info', `[SQLExec] ✓ Transaction command completed: ${sql}`);
        } else {
          this.log('debug', `[SQLExec] ✓ SQL executed successfully`);
        }
      }
      return;
    }

    // Use prepared statement for parameterized queries
    const sqlPtr = this.sqlite3._malloc(sql.length + 1);
    this.sqlite3.stringToUTF8(sql, sqlPtr, sql.length + 1);

    const stmtPtrPtr = this.sqlite3._malloc(4);
    const result = this.sqlite3._sqlite3_prepare_v2(this.dbPtr, sqlPtr, -1, stmtPtrPtr, 0);

    this.sqlite3._free(sqlPtr);

    if (result !== SQLITE_OK) {
      this.sqlite3._free(stmtPtrPtr);
      const errorPtr = this.sqlite3._sqlite3_errmsg(this.dbPtr);
      const errorMsg = this.sqlite3.UTF8ToString(errorPtr);
      this.log('error', `SQL preparation failed: ${sql} - Error: ${errorMsg}`);
      throw new DatabaseError(`Failed to prepare statement: ${errorMsg}`);
    }

    const stmtPtr = this.sqlite3.getValue(stmtPtrPtr, 'i32');
    this.sqlite3._free(stmtPtrPtr);

    try {
      // Bind parameters
      if (params) {
        if (Array.isArray(params)) {
          for (let i = 0; i < params.length; i++) {
            this.bindParameter(stmtPtr, i + 1, params[i]);
          }
        } else {
          // Handle Record<string, SQLValue>
          const keys = Object.keys(params);
          for (let i = 0; i < keys.length; i++) {
            this.bindParameter(stmtPtr, i + 1, params[keys[i]]);
          }
        }
      }

      // Execute the statement
      const stepResult = this.sqlite3._sqlite3_step(stmtPtr);

      if (stepResult !== SQLITE_DONE && stepResult !== SQLITE_ROW) {
        const errorPtr = this.sqlite3._sqlite3_errmsg(this.dbPtr);
        const errorMsg = this.sqlite3.UTF8ToString(errorPtr);
        this.log('error', `SQL execution failed: ${sql} - Error: ${errorMsg}`);
        throw new DatabaseError(`SQL execution failed: ${errorMsg}`);
      }

      this.log('debug', `SQL executed successfully with parameters: ${sql}`);
    } finally {
      this.sqlite3._sqlite3_finalize(stmtPtr);
    }
  }

  /**
   * Execute SQL query and return results
   */
  async select(sql: string, params?: ExtendedSQLParams): Promise<QueryResult> {
    if (!this.sqlite3 || !this.dbPtr) {
      throw new DatabaseError('Database not initialized');
    }

    this.operationCount++;
    const rows = this.executeQuery(this.dbPtr, sql, params);

    return {
      rows,
      columns: rows.length > 0 ? Object.keys(rows[0]) : []
    };
  }

  /**
   * Execute SQL query with parameters and return results
   */
  private executeQuery(dbPtr: number, sql: string, params?: ExtendedSQLParams): Record<string, any>[] {
    const sqlPtr = this.sqlite3!._malloc(sql.length + 1);
    this.sqlite3!.stringToUTF8(sql, sqlPtr, sql.length + 1);

    const stmtPtrPtr = this.sqlite3!._malloc(4);
    const result = this.sqlite3!._sqlite3_prepare_v2(dbPtr, sqlPtr, -1, stmtPtrPtr, 0);
    this.sqlite3!._free(sqlPtr);

    if (result !== SQLITE_OK) {
      this.sqlite3!._free(stmtPtrPtr);
      const errorPtr = this.sqlite3!._sqlite3_errmsg(dbPtr);
      const errorMsg = this.sqlite3!.UTF8ToString(errorPtr);
      throw new DatabaseError(`Failed to prepare statement: ${errorMsg}`);
    }

    const stmtPtr = this.sqlite3!.getValue(stmtPtrPtr, 'i32');
    this.sqlite3!._free(stmtPtrPtr);

    // Bind parameters if provided
    if (params) {
      if (Array.isArray(params) && params.length > 0) {
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          this.bindParameter(stmtPtr, i + 1, param);
        }
      } else if (!Array.isArray(params)) {
        // Handle Record<string, SQLValue>
        const keys = Object.keys(params);
        if (keys.length > 0) {
          for (let i = 0; i < keys.length; i++) {
            this.bindParameter(stmtPtr, i + 1, params[keys[i]]);
          }
        }
      }
    }

    const rows: Record<string, any>[] = [];

    try {
      while (this.sqlite3!._sqlite3_step(stmtPtr) === SQLITE_ROW) {
        const colCount = this.sqlite3!._sqlite3_column_count(stmtPtr);
        const row: Record<string, any> = {};

        for (let i = 0; i < colCount; i++) {
          const colName = this.sqlite3!.UTF8ToString(this.sqlite3!._sqlite3_column_name(stmtPtr, i));
          const colType = this.sqlite3!._sqlite3_column_type(stmtPtr, i);
          row[colName] = this.extractColumnValue(stmtPtr, i, colType);
        }

        rows.push(row);
      }
    } finally {
      this.sqlite3!._sqlite3_finalize(stmtPtr);
    }

    return rows;
  }

  /**
   * Bind parameter to prepared statement
   */
  private bindParameter(stmtPtr: number, index: number, param: ExtendedSQLValue): void {
    if (!this.sqlite3) {
      throw new DatabaseError('SQLite not initialized');
    }

    if (param === null || param === undefined) {
      this.sqlite3._sqlite3_bind_null(stmtPtr, index);
    } else if (typeof param === 'number') {
      if (Number.isInteger(param)) {
        this.sqlite3._sqlite3_bind_int(stmtPtr, index, param);
      } else {
        this.sqlite3._sqlite3_bind_double(stmtPtr, index, param);
      }
    } else if (typeof param === 'string') {
      const paramPtr = this.sqlite3._malloc(param.length + 1);
      this.sqlite3.stringToUTF8(param, paramPtr, param.length + 1);
      this.sqlite3._sqlite3_bind_text(stmtPtr, index, paramPtr, -1, SQLITE_TRANSIENT);
      this.sqlite3._free(paramPtr);
    } else if (param instanceof Uint8Array) {
      const paramPtr = this.sqlite3._malloc(param.length);
      if (this.sqlite3.writeArrayToMemory) {
        this.sqlite3.writeArrayToMemory(param, paramPtr);
      } else {
        // Fallback for older WASM versions
        for (let j = 0; j < param.length; j++) {
          this.sqlite3.setValue(paramPtr + j, param[j], 'i8');
        }
      }
      this.sqlite3._sqlite3_bind_blob(stmtPtr, index, paramPtr, param.length, SQLITE_TRANSIENT);
      this.sqlite3._free(paramPtr);
    } else if (param instanceof Float32Array) {
      // Special handling for Float32Array (vectors)
      const byteArray = new Uint8Array(param.buffer);
      this.bindParameter(stmtPtr, index, byteArray);
    }
  }

  /**
   * Extract column value from result set
   */
  private extractColumnValue(stmtPtr: number, columnIndex: number, columnType: number): any {
    if (!this.sqlite3) {
      throw new DatabaseError('SQLite not initialized');
    }

    switch (columnType) {
      case SQLITE_INTEGER:
        return this.sqlite3._sqlite3_column_int(stmtPtr, columnIndex);

      case SQLITE_FLOAT:
        return this.sqlite3._sqlite3_column_double(stmtPtr, columnIndex);

      case SQLITE_TEXT:
        return this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_column_text(stmtPtr, columnIndex));

      case SQLITE_BLOB:
        const blobPtr = this.sqlite3._sqlite3_column_blob(stmtPtr, columnIndex);
        const blobSize = this.sqlite3._sqlite3_column_bytes(stmtPtr, columnIndex);
        const value = new Uint8Array(blobSize);
        for (let j = 0; j < blobSize; j++) {
          value[j] = this.sqlite3.getValue(blobPtr + j, 'i8');
        }
        return value;

      case SQLITE_NULL:
      default:
        return null;
    }
  }

  /**
   * Serialize database to Uint8Array
   */
  async serialize(): Promise<Uint8Array> {
    if (!this.sqlite3 || !this.dbPtr) {
      throw new DatabaseError('Database not initialized');
    }

    const schemaName = 'main';
    const sizePtr = this.sqlite3._malloc(8); // 64-bit size
    const mainSchemaPtr = this.sqlite3._malloc(schemaName.length + 1);

    try {
      this.sqlite3.stringToUTF8(schemaName, mainSchemaPtr, schemaName.length + 1);

      if (typeof this.sqlite3._sqlite3_serialize !== 'function') {
        throw new DatabaseError('sqlite3_serialize function not available');
      }

      const dataPtr = this.sqlite3._sqlite3_serialize(this.dbPtr, mainSchemaPtr, sizePtr, 0);
      if (!dataPtr) {
        throw new DatabaseError('Failed to serialize database');
      }

      const size = this.sqlite3.getValue(sizePtr, 'i64');
      const data = new Uint8Array(Number(size));

      for (let i = 0; i < data.length; i++) {
        data[i] = this.sqlite3.getValue(dataPtr + i, 'i8');
      }

      this.sqlite3._free(dataPtr);
      this.log('debug', `Database serialized: ${data.length} bytes`);

      return data;
    } finally {
      this.sqlite3._free(sizePtr);
      this.sqlite3._free(mainSchemaPtr);
    }
  }

  /**
   * Deserialize database from Uint8Array
   */
  async deserialize(data: Uint8Array): Promise<void> {
    if (!this.sqlite3 || !this.dbPtr) {
      throw new DatabaseError('Database not initialized');
    }

    const schemaName = 'main';
    const schemaPtr = this.sqlite3._malloc(schemaName.length + 1);
    const dataPtr = this.sqlite3._malloc(data.length);

    try {
      this.sqlite3.stringToUTF8(schemaName, schemaPtr, schemaName.length + 1);

      // Copy data to WASM memory
      if (this.sqlite3.writeArrayToMemory) {
        this.sqlite3.writeArrayToMemory(data, dataPtr);
      } else {
        for (let i = 0; i < data.length; i++) {
          this.sqlite3.setValue(dataPtr + i, data[i], 'i8');
        }
      }

      if (typeof this.sqlite3._sqlite3_deserialize !== 'function') {
        throw new DatabaseError('sqlite3_deserialize function not available');
      }

      const result = this.sqlite3._sqlite3_deserialize(
        this.dbPtr,
        schemaPtr,
        dataPtr,
        BigInt(data.length),
        BigInt(data.length),
        0
      );

      if (result !== SQLITE_OK) {
        throw new DatabaseError(`Failed to deserialize database (SQLite error code: ${result})`);
      }

      this.log('debug', `Database deserialized: ${data.length} bytes`);
    } finally {
      this.sqlite3._free(schemaPtr);
      // Note: dataPtr is managed by SQLite after deserialize
    }
  }

  /**
   * Get database connection status
   */
  isConnected(): boolean {
    return this.sqlite3 !== null && this.dbPtr !== 0;
  }

  /**
   * Get SQLite version
   */
  getVersion(): string {
    if (!this.sqlite3) {
      return 'Not loaded';
    }

    return this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_libversion());
  }

  /**
   * Get operation count
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Get database pointer (for advanced operations)
   */
  getDbPtr(): number {
    return this.dbPtr;
  }

  /**
   * Get SQLite module reference (for advanced operations)
   */
  getSQLite3Module(): SQLite3Module | null {
    return this.sqlite3;
  }

  private log(level: string, message: string): void {
    if (this.logger) {
      this.logger.log(level, message);
    } else {
      console.log(`[SQLiteManager] ${level.toUpperCase()}: ${message}`);
    }
  }
}