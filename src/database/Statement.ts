/**
 * Statement Class - Complete sql.js Compatible Statement Wrapper
 * 
 * Provides a complete sql.js compatible Statement interface that works with
 * the LocalRetrieve Worker infrastructure for prepared statements.
 */

import type { 
  StatementAPI, 
  StatementState, 
  DatabaseAPI, 
  SQLValue, 
  SQLParams 
} from '../types/database.js';
import { StatementError, validateSQLParams } from '../types/database.js';
import {
  SQLStatement,
  SQLStatementError,
  isSQLParams,
  validateSQL as validateSQLQuery
} from '../types/sql.js';

export class Statement implements SQLStatement {
  private state: StatementState;
  private _boundParams?: SQLParams;
  private _finalized = false;
  private _results: Record<string, SQLValue>[] = [];
  private _currentIndex = -1;
  private _executed = false;
  private _sql: string;

  constructor(database: DatabaseAPI, sql: string) {
    this._sql = sql.trim();
    
    this.state = {
      sql: this._sql,
      bound: false,
      stepped: false,
      finished: false,
      currentRow: null,
      columns: [],
      database
    };

    if (!this.state.sql) {
      throw new SQLStatementError('SQL statement cannot be empty');
    }
  }

  /**
   * Get the SQL statement (sql.js compatible)
   */
  get sql(): string {
    return this._sql;
  }

  /**
   * Check if statement is finalized (sql.js compatible)
   */
  get finalized(): boolean {
    return this._finalized;
  }

  /**
   * Bind parameters to the prepared statement (sql.js compatible)
   */
  bind(params?: SQLParams): boolean {
    if (this._finalized) {
      throw new SQLStatementError('Cannot bind to finalized statement');
    }

    if (params !== undefined && !isSQLParams(params)) {
      throw new SQLStatementError('Invalid parameter types');
    }

    this.state.bound = true;
    this.reset(); // Reset any previous execution state
    
    // Store bound parameters for execution
    this._boundParams = params;

    return true; // sql.js returns boolean
  }

  /**
   * Execute one step of the statement (sql.js compatible)
   */
  step(): boolean {
    if (this._finalized) {
      throw new SQLStatementError('Cannot step finalized statement');
    }

    if (this.state.finished) {
      return false;
    }

    if (!this._executed) {
      // First step - execute the query using worker
      this._executeQuery();
      this._executed = true;
      this.state.stepped = true;
    }

    // Move to next row
    this._currentIndex++;
    
    if (this._currentIndex < this._results.length) {
      this.state.currentRow = this._results[this._currentIndex];
      
      // Extract columns from first row if not set
      if (this.state.columns.length === 0 && this.state.currentRow) {
        this.state.columns = Object.keys(this.state.currentRow);
      }
      
      return true;
    }

    this.state.finished = true;
    this.state.currentRow = null;
    return false;
  }

  /**
   * Get current row as array of values (sql.js compatible)
   */
  get(): SQLValue[] {
    if (!this.state.currentRow) {
      return [];
    }

    return this.state.columns.map(col => this.state.currentRow![col] ?? null);
  }

  /**
   * Get current row as object (sql.js compatible)
   */
  getAsObject(): { [column: string]: SQLValue } {
    if (!this.state.currentRow) {
      return {};
    }

    return { ...this.state.currentRow };
  }

  /**
   * Get column names (sql.js compatible)
   */
  getColumnNames(): string[] {
    return [...this.state.columns];
  }

  /**
   * Reset statement for re-execution (sql.js compatible)
   */
  reset(): boolean {
    if (this._finalized) {
      throw new SQLStatementError('Cannot reset finalized statement');
    }

    this.state.stepped = false;
    this.state.finished = false;
    this.state.currentRow = null;
    this._currentIndex = -1;
    this._executed = false;
    this._results = [];

    return true; // sql.js returns boolean
  }

  /**
   * Free/finalize the statement (sql.js compatible)
   */
  free(): boolean {
    if (this._finalized) {
      return true; // Already finalized
    }

    this._finalized = true;
    this.state.finished = true;
    this.state.currentRow = null;
    this._results = [];
    this._boundParams = undefined;

    // Remove from database's active statements if possible
    try {
      const database = this.state.database as any;
      if (database.activeStatements && database.activeStatements.has(this)) {
        database.activeStatements.delete(this);
      }
    } catch (error) {
      // Ignore errors during cleanup
    }

    return true; // sql.js returns boolean
  }

  /**
   * Async versions for enhanced API compatibility
   */
  async bindAsync(params?: SQLParams): Promise<boolean> {
    return this.bind(params);
  }

  async stepAsync(): Promise<boolean> {
    if (this._finalized) {
      throw new SQLStatementError('Cannot step finalized statement');
    }

    if (this.state.finished) {
      return false;
    }

    if (!this._executed) {
      // First step - execute the query using worker async
      await this._executeQueryAsync();
      this._executed = true;
      this.state.stepped = true;
    }

    // Move to next row
    this._currentIndex++;
    
    if (this._currentIndex < this._results.length) {
      this.state.currentRow = this._results[this._currentIndex];
      
      // Extract columns from first row if not set
      if (this.state.columns.length === 0 && this.state.currentRow) {
        this.state.columns = Object.keys(this.state.currentRow);
      }
      
      return true;
    }

    this.state.finished = true;
    this.state.currentRow = null;
    return false;
  }

  async getAsync(): Promise<SQLValue[]> {
    return this.get();
  }

  async getAsObjectAsync(): Promise<{ [column: string]: SQLValue }> {
    return this.getAsObject();
  }

  async resetAsync(): Promise<boolean> {
    return this.reset();
  }

  async freeAsync(): Promise<boolean> {
    return this.free();
  }

  /**
   * Get the SQL statement (for compatibility)
   */
  getSQL(): string {
    return this._sql;
  }

  /**
   * Get bound parameters (for debugging)
   */
  getBoundParams(): SQLParams | undefined {
    return this._boundParams;
  }

  /**
   * Execute the SQL query using the database's worker interface (synchronous)
   */
  private _executeQuery(): void {
    try {
      // Get access to the database's worker RPC
      const database = this.state.database as any;
      const workerRPC = database._getWorkerRPC?.();
      
      if (!workerRPC) {
        throw new SQLStatementError('Database worker not available');
      }

      // Execute query synchronously using a blocking async call
      // This is a compromise to maintain sql.js sync API
      this._executeWithWorkerSync(workerRPC);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLStatementError(`Query execution failed: ${message}`);
    }
  }

  /**
   * Execute the SQL query using the database's worker interface (asynchronous)
   */
  private async _executeQueryAsync(): Promise<void> {
    try {
      // Get access to the database's worker RPC
      const database = this.state.database as any;
      const workerRPC = database._getWorkerRPC?.();
      
      if (!workerRPC) {
        throw new SQLStatementError('Database worker not available');
      }

      // Execute query asynchronously
      const result = await workerRPC.select({
        sql: this.state.sql,
        params: this._boundParams
      });

      // Store results
      this._results = result?.rows || [];
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLStatementError(`Query execution failed: ${message}`);
    }
  }

  /**
   * Execute query with worker RPC (synchronous compatibility)
   * Uses synchronous blocking for sql.js compatibility
   */
  private _executeWithWorkerSync(workerRPC: any): void {
    // Create a promise for the worker call
    const executePromise = workerRPC.select({
      sql: this.state.sql,
      params: this._boundParams
    });

    // Block synchronously (this is not ideal but needed for sql.js compatibility)
    let isResolved = false;
    let result: any = null;
    let error: any = null;

    executePromise
      .then((res: any) => {
        result = res;
        isResolved = true;
      })
      .catch((err: any) => {
        error = err;
        isResolved = true;
      });

    // Busy wait for result (not ideal, but necessary for sync API)
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    while (!isResolved && (Date.now() - startTime) < timeout) {
      // Allow event loop to process with minimal busy wait
    }

    if (!isResolved) {
      throw new SQLStatementError(
        'SYNC/ASYNC COMPATIBILITY ISSUE:\n' +
        'Query execution timeout in sync compatibility mode.\n' +
        'SOLUTIONS:\n' +
        '1. Use async API: await statement.stepAsync() instead of statement.step()\n' +
        '2. Increase timeout in database configuration\n' +
        '3. Consider using sql.js directly on main thread for true sync operations\n' +
        '\nThis is a known limitation of browser worker architecture.'
      );
    }

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLStatementError(`Query execution failed: ${message}`);
    }

    // Store results
    this._results = result?.rows || [];
  }

  /**
   * Get execution statistics (debugging helper)
   */
  getStats(): {
    sql: string;
    bound: boolean;
    executed: boolean;
    resultCount: number;
    currentIndex: number;
    finalized: boolean;
  } {
    return {
      sql: this._sql,
      bound: this.state.bound,
      executed: this._executed,
      resultCount: this._results.length,
      currentIndex: this._currentIndex,
      finalized: this._finalized
    };
  }

  /**
   * Check if statement has results
   */
  hasResults(): boolean {
    return this._results.length > 0;
  }

  /**
   * Get all results at once (helper method)
   */
  getAllResults(): { [column: string]: SQLValue }[] {
    if (!this._executed) {
      throw new SQLStatementError('Statement not executed yet');
    }
    return [...this._results];
  }

  /**
   * Get all results as arrays (helper method)
   */
  getAllResultArrays(): SQLValue[][] {
    if (!this._executed) {
      throw new SQLStatementError('Statement not executed yet');
    }
    return this._results.map(row => 
      this.state.columns.map(col => row[col] ?? null)
    );
  }
}