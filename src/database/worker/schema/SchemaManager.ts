/**
 * SchemaManager
 *
 * Handles database schema initialization, migration, and versioning.
 * Manages the creation of all required tables and their relationships.
 */

import type { SQLiteManager } from '../core/SQLiteManager.js';
import type { CollectionInfo } from '../../../types/worker.js';
import { DatabaseError } from '../../../types/worker.js';

/**
 * Database schema version
 */
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * SchemaManager handles all database schema operations
 *
 * Responsibilities:
 * - Schema version management and migrations
 * - Initial database schema creation
 * - Collection table management
 * - Schema validation and consistency checks
 * - Migration path coordination
 */
export class SchemaManager {
  constructor(
    private sqliteManager: SQLiteManager,
    private logger?: { log: (level: string, message: string, data?: any) => void }
  ) {}

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    if (!this.sqliteManager.isConnected()) {
      throw new DatabaseError('Database not connected');
    }

    try {
      // Check for existing schema version and handle migrations
      let currentSchemaVersion = 0;
      let hasData = false;

      try {
        // Check if collections table exists and get schema version
        const versionResult = await this.sqliteManager.select('SELECT MAX(schema_version) as version FROM collections');
        if (versionResult.rows.length > 0 && versionResult.rows[0].version !== null) {
          currentSchemaVersion = versionResult.rows[0].version;
          this.log('info', `Current schema version: ${currentSchemaVersion}`);
        }

        // Check for data in expected tables
        const docCount = await this.sqliteManager.select('SELECT COUNT(*) as count FROM docs_default');
        hasData = docCount.rows.length > 0 && docCount.rows[0].count > 0;

        // If we have the latest schema version and data, skip initialization
        if (currentSchemaVersion === CURRENT_SCHEMA_VERSION && hasData) {
          this.log('info', 'Schema is up-to-date, skipping initialization');
          return;
        }
      } catch (error) {
        // Tables don't exist yet, proceed with initialization
        this.log('debug', 'Schema tables do not exist yet, proceeding with initialization');
      }

      // Handle schema migrations if we have an older version
      if (currentSchemaVersion > 0 && currentSchemaVersion < CURRENT_SCHEMA_VERSION) {
        throw new DatabaseError(
          `Database schema v${currentSchemaVersion} detected. Schema v3 requires database recreation. ` +
          `Please export your data, clear the database (db.clearAsync()), and reimport.`
        );
      }

      // Check if schema already exists (from restored database)
      await this.validateAndCleanupSchema();

      // Create the complete schema
      await this.createSchema();

      this.log('info', 'Schema initialized successfully');
    } catch (error) {
      throw new DatabaseError(`Schema initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate schema from older version to current version
   */
  async migrateSchema(currentVersion: number): Promise<void> {
    this.log('info', `Migrating schema from version ${currentVersion} to version ${CURRENT_SCHEMA_VERSION}`);

    try {

      // Add future migrations here as needed

      this.log('info', `Successfully migrated from schema version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`);
    } catch (error) {
      throw new DatabaseError(`Schema migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate from schema version 1 to version 2
   */
  private async migrateFromV1ToV2(): Promise<void> {
    // Add new columns to collections table
    await this.sqliteManager.exec(`
      ALTER TABLE collections ADD COLUMN embedding_provider TEXT DEFAULT 'local';
      ALTER TABLE collections ADD COLUMN embedding_dimensions INTEGER DEFAULT 384;
      ALTER TABLE collections ADD COLUMN embedding_status TEXT DEFAULT 'enabled' CHECK(embedding_status IN ('enabled', 'disabled', 'pending'));
      ALTER TABLE collections ADD COLUMN processing_status TEXT DEFAULT 'idle' CHECK(processing_status IN ('idle', 'processing', 'error'));
    `);

    // Create embedding queue table
    await this.sqliteManager.exec(`
      CREATE TABLE IF NOT EXISTS embedding_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        completed_at INTEGER,
        processed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY(collection_name) REFERENCES collections(name) ON DELETE CASCADE
      );
    `);

    // Create indexes for embedding queue performance
    await this.sqliteManager.exec(`
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_collection ON embedding_queue(collection_name);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_created ON embedding_queue(created_at);
    `);

    // Update schema version to 2
    await this.sqliteManager.exec(`
      UPDATE collections SET schema_version = 2, updated_at = strftime('%s', 'now')
    `);
  }


  /**
   * Validate existing schema and cleanup incomplete installations
   */
  private async validateAndCleanupSchema(): Promise<void> {
    // Check for all required tables (both regular and virtual)
    const allTables = await this.sqliteManager.select(`
      SELECT name FROM sqlite_master
      WHERE name IN ('docs_default', 'collections', 'fts_default', 'vec_default_dense', 'embedding_queue')
      ORDER BY name
    `);

    this.log('info', `Raw table query results:`, allTables.rows);

    const foundTableNames = allTables.rows.map(row => row.name);
    const requiredTables = ['docs_default', 'collections', 'fts_default', 'vec_default_dense'];

    // Check if we have a partial schema (some but not all required tables)
    const hasAllRequired = requiredTables.every(table => foundTableNames.includes(table));
    const hasSomeRequired = requiredTables.some(table => foundTableNames.includes(table));

    if (hasSomeRequired && !hasAllRequired) {
      this.log('warn', 'Detected incomplete schema - cleaning up and recreating');
      await this.cleanupIncompleteSchema(foundTableNames);
    } else if (hasAllRequired) {
      this.log('info', 'Complete schema detected, skipping initialization');
      return;
    }
  }

  /**
   * Clean up incomplete schema installation
   */
  private async cleanupIncompleteSchema(tableNames: string[]): Promise<void> {
    // Drop virtual tables first (FTS and vector tables)
    const virtualTables = ['fts_default', 'vec_default_dense'];
    for (const virtualTable of virtualTables) {
      if (tableNames.includes(virtualTable)) {
        try {
          await this.sqliteManager.exec(`DROP TABLE IF EXISTS ${virtualTable}`);
          this.log('info', `Dropped virtual table: ${virtualTable}`);
        } catch (error) {
          this.log('warn', `Failed to drop virtual table ${virtualTable}: ${error}`);
        }
      }
    }

    // Drop remaining regular tables
    const regularTablesToClean = ['docs_default', 'collections', 'embedding_queue'];
    for (const regularTable of regularTablesToClean) {
      if (tableNames.includes(regularTable)) {
        try {
          await this.sqliteManager.exec(`DROP TABLE IF EXISTS ${regularTable}`);
          this.log('info', `Dropped regular table: ${regularTable}`);
        } catch (error) {
          this.log('warn', `Failed to drop regular table ${regularTable}: ${error}`);
        }
      }
    }
  }

  /**
   * Create complete database schema
   */
  private async createSchema(): Promise<void> {
    await this.sqliteManager.exec(`
      -- Base documents table (v3 schema with separate collection column)
      CREATE TABLE IF NOT EXISTS docs_default (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        collection TEXT NOT NULL DEFAULT 'default',
        metadata JSON,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Index for efficient collection filtering
      CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs_default(collection);

      -- Full-text search table (EXTERNAL CONTENT - requires manual sync)
      -- NOTE: FTS5 sync is handled manually in DatabaseWorker to avoid
      --       memory exhaustion during batch transactions
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
        title, content, metadata,
        content=docs_default,
        content_rowid=rowid
      );

      -- Vector search table (384-dimensional dense vectors)
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_default_dense USING vec0(
        embedding float[384]
      );

      -- Collections metadata with embedding configuration
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        schema_version INTEGER DEFAULT ${CURRENT_SCHEMA_VERSION},
        config JSON,
        embedding_provider TEXT DEFAULT 'local',
        embedding_dimensions INTEGER DEFAULT 384,
        embedding_status TEXT DEFAULT 'enabled' CHECK(embedding_status IN ('enabled', 'disabled', 'pending')),
        processing_status TEXT DEFAULT 'idle' CHECK(processing_status IN ('idle', 'processing', 'error'))
      );

      -- Embedding queue for background processing
      CREATE TABLE IF NOT EXISTS embedding_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        completed_at INTEGER,
        processed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY(collection_name) REFERENCES collections(name) ON DELETE CASCADE
      );

      -- Create indexes for embedding queue performance
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_collection ON embedding_queue(collection_name);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_created ON embedding_queue(created_at);

      -- Insert default collection info
      INSERT OR IGNORE INTO collections (name, config)
      VALUES ('default', '{"vectorDim": 384, "metric": "cosine"}');
    `);
  }

  /**
   * Get collection information
   */
  async getCollectionInfo(name: string): Promise<CollectionInfo> {
    try {
      const collectionResult = await this.sqliteManager.select(
        'SELECT * FROM collections WHERE name = ?',
        [name]
      );

      if (collectionResult.rows.length === 0) {
        throw new DatabaseError(`Collection '${name}' not found`);
      }

      const collection = collectionResult.rows[0];

      // Get document count (using collection column in v3+)
      const countResult = await this.sqliteManager.select(
        `SELECT COUNT(*) as count FROM docs_default WHERE collection = ?`,
        [name]
      );

      let config;
      try {
        config = JSON.parse(collection.config || '{}');
      } catch {
        config = {};
      }

      return {
        name: collection.name,
        createdAt: collection.created_at,
        schemaVersion: collection.schema_version,
        vectorDimensions: config.vectorDim || 384,
        documentCount: countResult.rows[0]?.count || 0
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get collection info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(
    name: string,
    dimensions: number = 384,
    config: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Check if collection already exists
      const existing = await this.sqliteManager.select(
        'SELECT name FROM collections WHERE name = ?',
        [name]
      );

      if (existing.rows.length > 0) {
        throw new DatabaseError(`Collection '${name}' already exists`);
      }

      const collectionMetadata = {
        vectorDim: dimensions,
        metric: 'cosine',
        ...config
      };

      await this.sqliteManager.exec(`
        INSERT INTO collections (name, config, schema_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Use select to avoid parameter binding issues
      const timestamp = Math.floor(Date.now() / 1000);
      const result = await this.sqliteManager.select(
        `SELECT ? as name, ? as config, ? as schema_version, ? as created_at, ? as updated_at`,
        [
          name,
          JSON.stringify(collectionMetadata),
          CURRENT_SCHEMA_VERSION,
          timestamp,
          timestamp
        ]
      );

      // Insert the data
      await this.sqliteManager.exec(
        `INSERT INTO collections (name, config, schema_version, created_at, updated_at)
         VALUES ('${name}', '${JSON.stringify(collectionMetadata)}', ${CURRENT_SCHEMA_VERSION}, ${timestamp}, ${timestamp})`
      );

      this.log('info', `Collection '${name}' created with ${dimensions} dimensions`);
    } catch (error) {
      throw new DatabaseError(`Failed to create collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    try {
      const result = await this.sqliteManager.select(
        'SELECT name FROM collections WHERE name = ?',
        [name]
      );
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current schema version
   */
  async getSchemaVersion(): Promise<number> {
    try {
      const result = await this.sqliteManager.select('SELECT MAX(schema_version) as version FROM collections');
      return result.rows[0]?.version || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Validate schema integrity
   */
  async validateSchema(): Promise<boolean> {
    try {
      const requiredTables = ['docs_default', 'collections', 'fts_default', 'vec_default_dense'];

      for (const table of requiredTables) {
        const result = await this.sqliteManager.select(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [table]
        );
        if (result.rows.length === 0) {
          this.log('error', `Required table '${table}' is missing`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.log('error', `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private log(level: string, message: string, data?: any): void {
    if (this.logger) {
      this.logger.log(level, message, data);
    } else {
      console.log(`[SchemaManager] ${level.toUpperCase()}: ${message}`, data ? data : '');
    }
  }
}