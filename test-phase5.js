/**
 * Simple test script to verify Phase 5 implementation
 * Tests schema initialization with embedding queue and enhanced collections table
 */

// Use dynamic imports to load the LocalRetrieve SDK
(async () => {
  try {
    console.log('Phase 5 Test: Starting schema validation...');

    // Import the SDK
    const { Database } = await import('./dist/localretrieve.mjs');

    console.log('✓ SDK loaded successfully');

    // Create a new database instance
    const db = new Database();

    console.log('✓ Database instance created');

    // Initialize with a test database
    await db.open('opfs:/test-phase5/test.db');

    console.log('✓ Database opened successfully');

    // Test schema initialization
    console.log('Testing schema initialization...');

    // Check if all required tables exist
    const tables = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `);

    console.log('Tables found:', tables);

    const expectedTables = [
      'collections',
      'docs_default',
      'embedding_queue',
      'fts_default',
      'vec_default_dense'
    ];

    const foundTables = tables.map(row => row.name).sort();

    // Check if all expected tables exist
    let allTablesExist = true;
    for (const expectedTable of expectedTables) {
      if (!foundTables.includes(expectedTable)) {
        console.error(`✗ Missing table: ${expectedTable}`);
        allTablesExist = false;
      } else {
        console.log(`✓ Table exists: ${expectedTable}`);
      }
    }

    if (allTablesExist) {
      console.log('✓ All required tables exist');
    } else {
      console.error('✗ Schema validation failed');
      return;
    }

    // Test enhanced collections table schema
    console.log('\nTesting enhanced collections table schema...');
    const collectionsSchema = db.exec(`
      PRAGMA table_info(collections)
    `);

    console.log('Collections table schema:', collectionsSchema);

    const expectedColumns = [
      'name', 'created_at', 'updated_at', 'schema_version', 'config',
      'embedding_provider', 'embedding_dimensions', 'embedding_status', 'processing_status'
    ];

    const foundColumns = collectionsSchema.map(row => row.name);

    for (const expectedColumn of expectedColumns) {
      if (foundColumns.includes(expectedColumn)) {
        console.log(`✓ Column exists in collections: ${expectedColumn}`);
      } else {
        console.error(`✗ Missing column in collections: ${expectedColumn}`);
      }
    }

    // Test embedding queue table schema
    console.log('\nTesting embedding queue table schema...');
    const queueSchema = db.exec(`
      PRAGMA table_info(embedding_queue)
    `);

    console.log('Embedding queue table schema:', queueSchema);

    const expectedQueueColumns = [
      'id', 'collection_name', 'document_id', 'text_content', 'priority',
      'status', 'created_at', 'processed_at', 'error_message'
    ];

    const foundQueueColumns = queueSchema.map(row => row.name);

    for (const expectedColumn of expectedQueueColumns) {
      if (foundQueueColumns.includes(expectedColumn)) {
        console.log(`✓ Column exists in embedding_queue: ${expectedColumn}`);
      } else {
        console.error(`✗ Missing column in embedding_queue: ${expectedColumn}`);
      }
    }

    // Test schema version
    console.log('\nTesting schema version...');
    const versionResult = db.exec(`
      SELECT schema_version FROM collections WHERE name = 'default'
    `);

    if (versionResult.length > 0) {
      const schemaVersion = versionResult[0].schema_version;
      console.log(`✓ Schema version: ${schemaVersion}`);

      if (schemaVersion >= 2) {
        console.log('✓ Schema version is up to date (v2+)');
      } else {
        console.error(`✗ Schema version is outdated: ${schemaVersion}`);
      }
    } else {
      console.error('✗ Could not retrieve schema version');
    }

    // Clean up
    await db.close();
    console.log('\n✓ Phase 5 schema validation completed successfully!');

  } catch (error) {
    console.error('✗ Phase 5 test failed:', error.message);
    console.error('Stack:', error.stack);
  }
})();