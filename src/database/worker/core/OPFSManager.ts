/**
 * OPFSManager
 *
 * Handles Origin Private File System (OPFS) persistence operations.
 * Manages database synchronization between in-memory SQLite and OPFS storage.
 */

import { OPFSError } from '../../../types/worker.js';
import type { SQLiteManager } from './SQLiteManager.js';

/**
 * Storage quota information
 */
export interface StorageQuota {
  available: number;
  used: number;
  total: number;
}

/**
 * OPFSManager handles all OPFS persistence operations
 *
 * Responsibilities:
 * - OPFS availability checking
 * - Database file persistence to OPFS
 * - Periodic background synchronization
 * - Storage quota management
 * - Error handling and fallback strategies
 * - Database restoration from OPFS
 */
export class OPFSManager {
  private opfsPath: string | null = null;
  private tempDbName: string | null = null;
  private lastSyncTime = 0;
  private syncInterval = 5000; // Sync every 5 seconds
  private syncTimer: NodeJS.Timeout | null = null;
  private pendingDatabaseData: Uint8Array | null = null;

  constructor(
    private sqliteManager: SQLiteManager,
    private logger?: { log: (level: string, message: string) => void }
  ) {}

  /**
   * Initialize OPFS database with persistence support
   * Creates a temporary file that is periodically synced to OPFS
   */
  async initializeDatabase(opfsPath: string): Promise<string> {
    try {
      // Extract the actual file path from opfs:// URL
      const dbPath = opfsPath.replace(/^opfs:\/\/?/, '');

      // Check if OPFS is supported
      if (!this.isOPFSSupported()) {
        this.log('warn', 'OPFS not supported, falling back to memory database');
        return ':memory:';
      }

      // Create a unique in-memory filename that we'll track for OPFS syncing
      const tempDbName = `:opfs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}:`;

      // Store the OPFS path for later syncing
      this.opfsPath = dbPath;
      this.tempDbName = tempDbName;

      // Try to load existing data from OPFS
      try {
        await this.loadDatabaseFromOPFS(dbPath);
        this.log('info', `Loaded existing database from OPFS: ${dbPath}`);
      } catch (error) {
        this.log('info', `Creating new database for OPFS path: ${dbPath}`);
      }

      return tempDbName;
    } catch (error) {
      this.log('warn', `OPFS initialization failed: ${error instanceof Error ? error.message : String(error)}, using memory database`);
      return ':memory:';
    }
  }

  /**
   * Check if OPFS is supported by the browser
   */
  isOPFSSupported(): boolean {
    return typeof navigator !== 'undefined' &&
           typeof navigator.storage !== 'undefined' &&
           typeof navigator.storage.getDirectory === 'function';
  }

  /**
   * Load database from OPFS storage
   */
  async loadDatabaseFromOPFS(dbPath: string): Promise<void> {
    try {
      if (!this.isOPFSSupported()) {
        throw new Error('OPFS not supported');
      }

      const opfsRoot = await navigator.storage.getDirectory();
      const pathParts = dbPath.split('/').filter(part => part.length > 0);

      // Navigate to the file
      let currentDir = opfsRoot;
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: false });
      }

      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const data = new Uint8Array(await file.arrayBuffer());

      if (data.length === 0) {
        throw new Error('Empty database file');
      }

      // Store the data to be applied after the database is created
      this.pendingDatabaseData = data;
      this.log('info', `Loaded ${data.length} bytes from OPFS: ${dbPath}`);
    } catch (error) {
      const opfsError = new OPFSError(`Failed to load from OPFS: ${error instanceof Error ? error.message : String(error)}`);
      this.handleOPFSError(opfsError, 'load');
      throw opfsError;
    }
  }

  /**
   * Save database to OPFS storage
   */
  async saveDatabaseToOPFS(): Promise<void> {
    if (!this.opfsPath || !this.sqliteManager.isConnected()) {
      return;
    }

    try {
      if (!this.isOPFSSupported()) {
        throw new Error('OPFS not supported');
      }

      // Serialize the current database
      const data = await this.sqliteManager.serialize();

      // Check if we have enough space
      await this.ensureSufficientSpace(data.length * 2); // Conservative estimate with buffer

      // Get OPFS root directory
      const opfsRoot = await navigator.storage.getDirectory();
      const pathParts = this.opfsPath.split('/').filter(part => part.length > 0);

      // Create directories as needed
      let currentDir = opfsRoot;
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
      }

      // Create/update the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      // Convert Uint8Array to ArrayBuffer for OPFS write
      const buffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(buffer);
      view.set(data);
      await writable.write(buffer);
      await writable.close();

      this.lastSyncTime = Date.now();
      this.log('debug', `Saved ${data.length} bytes to OPFS: ${this.opfsPath}`);
    } catch (error) {
      // Handle OPFS errors gracefully - background sync failures shouldn't crash the app
      this.handleOPFSError(error instanceof Error ? error : new Error(String(error)), 'save');
    }
  }

  /**
   * Clear OPFS database file
   */
  async clearDatabase(): Promise<void> {
    if (!this.opfsPath) {
      return;
    }

    try {
      if (!this.isOPFSSupported()) {
        this.log('warn', 'OPFS not supported, cannot clear database');
        return;
      }

      const opfsRoot = await navigator.storage.getDirectory();
      const pathParts = this.opfsPath.split('/').filter(part => part.length > 0);

      // Navigate to the file
      let currentDir = opfsRoot;
      for (let i = 0; i < pathParts.length - 1; i++) {
        try {
          currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: false });
        } catch {
          // Directory doesn't exist, nothing to clear
          this.log('debug', `Directory ${pathParts[i]} doesn't exist, nothing to clear`);
          return;
        }
      }

      const fileName = pathParts[pathParts.length - 1];
      try {
        await currentDir.removeEntry(fileName);
        this.log('info', `Cleared OPFS database: ${this.opfsPath}`);
      } catch {
        // File doesn't exist, nothing to clear
        this.log('debug', `File ${fileName} doesn't exist, nothing to clear`);
      }
    } catch (error) {
      this.handleOPFSError(error instanceof Error ? error : new Error(String(error)), 'clear');
    }
  }

  /**
   * Start automatic OPFS synchronization
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return; // Already started
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.saveDatabaseToOPFS();
      } catch (error) {
        this.log('warn', `Auto-sync failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, this.syncInterval);

    this.log('info', `Started OPFS auto-sync with interval: ${this.syncInterval}ms`);
  }

  /**
   * Stop automatic OPFS synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.log('info', 'Stopped OPFS auto-sync');
    }
  }

  /**
   * Force immediate OPFS synchronization
   */
  async forceSync(): Promise<void> {
    if (this.opfsPath && this.sqliteManager.isConnected()) {
      await this.saveDatabaseToOPFS();
      this.log('info', 'Force sync completed');
    }
  }

  /**
   * Check OPFS storage quota
   */
  async checkQuota(): Promise<StorageQuota> {
    try {
      if (!this.isOPFSSupported() || !navigator.storage.estimate) {
        return { available: -1, used: -1, total: -1 };
      }

      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;

      return {
        available,
        used: usage,
        total: quota
      };
    } catch (error) {
      this.log('warn', `Failed to check storage quota: ${error instanceof Error ? error.message : String(error)}`);
      return { available: -1, used: -1, total: -1 };
    }
  }

  /**
   * Ensure sufficient storage space is available
   */
  async ensureSufficientSpace(requiredBytes: number): Promise<void> {
    const quota = await this.checkQuota();

    if (quota.available === -1) {
      this.log('warn', 'Cannot determine storage quota, proceeding with caution');
      return;
    }

    if (quota.available < requiredBytes) {
      const availableMB = (quota.available / (1024 * 1024)).toFixed(2);
      const requiredMB = (requiredBytes / (1024 * 1024)).toFixed(2);

      throw new OPFSError(
        `Insufficient storage space. Available: ${availableMB}MB, Required: ${requiredMB}MB. ` +
        'Please clear browser data or use database.export() to backup your data.'
      );
    }
  }

  /**
   * Get pending database data for restoration
   */
  getPendingDatabaseData(): Uint8Array | null {
    return this.pendingDatabaseData;
  }

  /**
   * Clear pending database data after restoration
   */
  clearPendingDatabaseData(): void {
    this.pendingDatabaseData = null;
  }

  /**
   * Get OPFS path
   */
  getOPFSPath(): string | null {
    return this.opfsPath;
  }

  /**
   * Get temporary database name
   */
  getTempDbName(): string | null {
    return this.tempDbName;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Handle OPFS-specific errors with appropriate logging and user guidance
   */
  private handleOPFSError(error: Error, operation: string): void {
    this.log('error', `OPFS ${operation} failed: ${error.message}`);

    if (error.message.includes('quota') || error.message.includes('storage')) {
      this.log('warn', 'Storage quota exceeded. Consider clearing data or using export functionality.');
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      this.log('warn', 'OPFS access denied. Browser may not support OPFS or permissions are restricted.');
    } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
      this.log('warn', 'Database file may be corrupted. Consider recreating the database.');
    } else {
      this.log('warn', 'Unexpected OPFS error. Data may not persist between sessions.');
    }

    // Suggest mitigation strategies
    this.log('info', 'Mitigation strategies:');
    this.log('info', '1. Use database.export() to backup your data');
    this.log('info', '2. Clear browser storage to free up space');
    this.log('info', '3. Use an in-memory database if persistence is not required');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopAutoSync();
    this.opfsPath = null;
    this.tempDbName = null;
    this.pendingDatabaseData = null;
    this.lastSyncTime = 0;
  }

  private log(level: string, message: string): void {
    if (this.logger) {
      this.logger.log(level, message);
    } else {
      console.log(`[OPFSManager] ${level.toUpperCase()}: ${message}`);
    }
  }
}