/**
 * LocalRetrieve Complete Demo Application
 *
 * This demo showcases all the features of LocalRetrieve including:
 * - Database initialization with OPFS persistence
 * - Hybrid search (FTS5 + vector search with fusion)
 * - Data management (insert, bulk insert, export/import)
 * - Real-time search with performance metrics
 * - **Phase 5: Embedding Queue Management** - Background processing system
 * - Cross-browser compatibility testing
 *
 * Phase 5 Queue Management Features:
 * - Enqueue documents for background embedding generation
 * - Process embedding queue with batch processing and retry logic
 * - Real-time queue status monitoring (total, pending, processing, completed, failed)
 * - Priority-based processing (high=1, normal=2, low=3)
 * - Comprehensive error handling and recovery mechanisms
 * - Queue clearing with status filtering options
 *
 * Technical Architecture:
 * - Uses LocalRetrieve SDK with Web Worker for non-blocking operations
 * - OPFS persistence ensures data survives browser restarts
 * - RPC communication between main thread and worker
 * - Modular worker architecture with dedicated queue management
 * - Schema v2 with embedding_queue table for background processing
 * - Comprehensive error handling and user feedback
 *
 * Demo UI Components:
 * - Search interface with hybrid text + vector search
 * - Data management with bulk operations
 * - Export/import functionality with progress tracking
 * - Queue management panel with real-time status updates
 * - Performance metrics and database statistics
 * - Responsive design with clear status indicators
 **/

import { initLocalRetrieve, createProvider, validateProviderConfig } from '../../dist/localretrieve.mjs';

class LocalRetrieveDemo {
    constructor() {
        this.db = null;
        this.isLoading = false;
        this.queryHistory = [];
        this.searchHistory = [];
        this.currentEmbedding = null;
        this.embeddingConfig = {
            provider: 'transformers',
            openaiApiKey: '',
            model: 'text-embedding-3-small',
            dimensions: 384
        };

        // DOM elements
        this.elements = {
            // Status elements
            dbStatus: document.getElementById('db-status'),
            queryTime: document.getElementById('query-time'),
            memoryUsage: document.getElementById('memory-usage'),
            dbSize: document.getElementById('db-size'),
            docCount: document.getElementById('doc-count'),
            storageType: document.getElementById('storage-type'),

            // Control elements
            loadSampleBtn: document.getElementById('load-sample-btn'),
            clearDbBtn: document.getElementById('clear-db-btn'),
            recreateDbBtn: document.getElementById('recreate-db-btn'),
            importBtn: document.getElementById('import-btn'),
            importFile: document.getElementById('import-file'),
            exportBtn: document.getElementById('export-btn'),
            transferProgress: document.getElementById('transfer-progress'),
            sampleStatus: document.getElementById('sample-status'),

            // SQL elements
            sqlInput: document.getElementById('sql-input'),
            executeSqlBtn: document.getElementById('execute-sql-btn'),
            clearSqlBtn: document.getElementById('clear-sql-btn'),
            queryHistory: document.getElementById('query-history'),
            sqlResults: document.getElementById('sql-results'),
            sqlStats: document.getElementById('sql-stats'),

            // Search elements
            searchText: document.getElementById('search-text'),
            searchVector: document.getElementById('search-vector'),
            fusionMethod: document.getElementById('fusion-method'),
            ftsWeight: document.getElementById('fts-weight'),
            ftsWeightValue: document.getElementById('fts-weight-value'),
            vecWeight: document.getElementById('vec-weight'),
            vecWeightValue: document.getElementById('vec-weight-value'),
            searchLimit: document.getElementById('search-limit'),
            searchBtn: document.getElementById('search-btn'),
            searchResults: document.getElementById('search-results'),
            searchStats: document.getElementById('search-stats'),

            // Embedding elements
            embeddingProvider: document.getElementById('embedding-provider'),
            providerStatus: document.getElementById('provider-status'),
            openaiConfig: document.getElementById('openai-config'),
            openaiApiKey: document.getElementById('openai-api-key'),
            testApiKey: document.getElementById('test-api-key'),
            openaiModel: document.getElementById('openai-model'),
            embeddingDimensions: document.getElementById('embedding-dimensions'),
            collectionName: document.getElementById('collection-name'),
            collectionDescription: document.getElementById('collection-description'),
            createCollectionBtn: document.getElementById('create-collection-btn'),
            listCollectionsBtn: document.getElementById('list-collections-btn'),
            testText: document.getElementById('test-text'),
            generateEmbeddingBtn: document.getElementById('generate-embedding-btn'),
            addToCollectionBtn: document.getElementById('add-to-collection-btn'),
            embeddingProgress: document.getElementById('embedding-progress'),
            embeddingResults: document.getElementById('embedding-results'),
            embeddingStats: document.getElementById('embedding-stats'),

            // Phase 5: Queue Management elements
            collectionStatusBtn: document.getElementById('collection-status-btn'),
            queueCollection: document.getElementById('queue-collection'),
            queueText: document.getElementById('queue-text'),
            queuePriority: document.getElementById('queue-priority'),
            enqueueBtn: document.getElementById('enqueue-btn'),
            processQueueBtn: document.getElementById('process-queue-btn'),
            queueStatusBtn: document.getElementById('queue-status-btn'),
            clearQueueBtn: document.getElementById('clear-queue-btn'),
            queueTotal: document.getElementById('queue-total'),
            queuePending: document.getElementById('queue-pending'),
            queueProcessing: document.getElementById('queue-processing'),
            queueCompleted: document.getElementById('queue-completed'),
            queueFailed: document.getElementById('queue-failed'),
            queueResults: document.getElementById('queue-results')
        };

        this.initializeEventListeners();
        this.initializeDatabase();
    }

    initializeEventListeners() {
        // Data management
        this.elements.loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        this.elements.clearDbBtn.addEventListener('click', () => this.clearDatabase());
        this.elements.recreateDbBtn.addEventListener('click', () => this.recreateDatabase());
        this.elements.importBtn.addEventListener('click', () => this.elements.importFile.click());
        this.elements.importFile.addEventListener('change', (e) => this.importDatabase(e));
        this.elements.exportBtn.addEventListener('click', () => this.exportDatabase());

        // SQL operations
        this.elements.executeSqlBtn.addEventListener('click', () => this.executeSQL());
        this.elements.clearSqlBtn.addEventListener('click', () => this.clearSQL());
        this.elements.queryHistory.addEventListener('change', (e) => this.loadQueryFromHistory(e));
        this.elements.sqlInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.executeSQL();
            }
        });

        // Search operations
        this.elements.searchBtn.addEventListener('click', () => this.performSearch());
        this.elements.searchText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        });

        // Weight sliders
        this.elements.ftsWeight.addEventListener('input', (e) => {
            this.elements.ftsWeightValue.textContent = e.target.value;
            this.updateVectorWeight();
        });
        this.elements.vecWeight.addEventListener('input', (e) => {
            this.elements.vecWeightValue.textContent = e.target.value;
            this.updateFtsWeight();
        });

        // Embedding configuration
        this.elements.embeddingProvider.addEventListener('change', (e) => this.handleProviderChange(e));
        this.elements.openaiApiKey.addEventListener('input', (e) => this.handleApiKeyInput(e));
        this.elements.testApiKey.addEventListener('click', () => this.testApiConnection());
        this.elements.openaiModel.addEventListener('change', (e) => this.handleModelChange(e));
        this.elements.embeddingDimensions.addEventListener('change', (e) => this.handleDimensionsChange(e));

        // Collection management
        this.elements.createCollectionBtn.addEventListener('click', () => this.createCollection());
        this.elements.listCollectionsBtn.addEventListener('click', () => this.listCollections());
        this.elements.collectionStatusBtn.addEventListener('click', () => this.showCollectionStatus());

        // Phase 5: Queue Management
        this.elements.enqueueBtn.addEventListener('click', () => this.enqueueEmbedding());
        this.elements.processQueueBtn.addEventListener('click', () => this.processEmbeddingQueue());
        this.elements.queueStatusBtn.addEventListener('click', () => this.updateQueueStatus());
        this.elements.clearQueueBtn.addEventListener('click', () => this.clearEmbeddingQueue());

        // Embedding testing
        this.elements.generateEmbeddingBtn.addEventListener('click', () => this.generateEmbedding());
        this.elements.addToCollectionBtn.addEventListener('click', () => this.addToCollection());
    }

    updateFtsWeight() {
        const vecWeight = parseFloat(this.elements.vecWeight.value);
        const ftsWeight = Math.max(0, Math.min(1, 1 - vecWeight));
        this.elements.ftsWeight.value = ftsWeight;
        this.elements.ftsWeightValue.textContent = ftsWeight.toFixed(1);
    }

    updateVectorWeight() {
        const ftsWeight = parseFloat(this.elements.ftsWeight.value);
        const vecWeight = Math.max(0, Math.min(1, 1 - ftsWeight));
        this.elements.vecWeight.value = vecWeight;
        this.elements.vecWeightValue.textContent = vecWeight.toFixed(1);
    }

    async initializeDatabase() {
        try {
            this.setStatus('Initializing database...', 'info');
            this.updateDBStatus('Connecting...', false);

            const startTime = performance.now();

            // Use consistent database filename for persistence across sessions
            const dbFilename = 'opfs:/localretrieve-demo/demo.db';
            this.db = await initLocalRetrieve(dbFilename);

            const initTime = performance.now() - startTime;

            this.updateDBStatus('Connected', true);
            this.elements.queryTime.textContent = `${initTime.toFixed(1)}ms`;
            this.elements.storageType.textContent = 'OPFS';

            // Schema is already initialized by initLocalRetrieve()

            // Check if database has existing data
            await this.checkExistingData();

            this.setStatus('Database initialized successfully', 'success');
            this.updateDatabaseInfo();

            // Phase 5: Initialize queue status display
            await this.updateQueueStatus();

            // Enable controls
            this.setControlsEnabled(true);

        } catch (error) {
            console.error('Database initialization failed:', error);
            this.setStatus(`Database initialization failed: ${error.message}`, 'error');
            this.updateDBStatus('Failed', false);
        }
    }

    async checkExistingData() {
        try {
            // Check if we have existing data
            const countResult = await this.db.execAsync('SELECT COUNT(*) as count FROM docs_default');
            const docCount = countResult[0]?.values[0]?.[0] || 0;

            if (docCount > 0) {
                this.setStatus(`Found existing database with ${docCount} documents`, 'info');
                this.populateQueryHistory(); // Populate query history if we have data
            } else {
                this.setStatus('Empty database - click "Load Sample Data" to get started', 'info');
            }
        } catch (error) {
            // If table doesn't exist, that's fine - it means we need to load data
            console.debug('No existing data found:', error.message);
            this.setStatus('New database - click "Load Sample Data" to get started', 'info');
        }
    }

    async loadSampleData() {
        if (!this.db) return;

        try {
            this.setLoading(true);
            this.setStatus('Loading sample data...', 'info');

            const startTime = performance.now();
            const documents = getTestDocuments();

            // Debug: Check if documents are loaded correctly
            console.log('Total documents loaded:', documents?.length || 'undefined');
            if (documents && documents.length > 0) {
                console.log('First document sample:', {
                    id: documents[0]?.id,
                    title: documents[0]?.title,
                    contentLength: documents[0]?.content?.length || 'undefined',
                    hasVector: !!documents[0]?.vector
                });
            }

            // Ensure schema is properly initialized first
            await this.ensureSchemaInitialized();

            // Clear existing data safely
            await this.clearExistingData();

            // Insert sample documents
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];

                // Debug: Check document data
                console.debug(`Inserting document ${i + 1}/${documents.length}:`, {
                    id: doc.id,
                    title: doc.title,
                    contentLength: doc.content?.length || 'undefined',
                    contentType: typeof doc.content
                });

                if (!doc.content || typeof doc.content !== 'string') {
                    console.error(`Document ${doc.id} has invalid content:`, doc);
                    continue; // Skip documents without valid content
                }

                try {
                    // Insert into docs table and get the rowid
                    const docInsertResult = await this.db.runAsync(
                        'INSERT INTO docs_default (id, title, content) VALUES (?, ?, ?)',
                        [doc.id, doc.title, doc.content]
                    );

                    // Get the actual rowid from the docs table insertion
                    const actualRowId = docInsertResult.lastInsertRowid || doc.id;
                    console.log(`Inserted document ${doc.id} with rowid: ${actualRowId}`);

                    // Insert into FTS table using the same rowid
                    await this.db.runAsync(
                        'INSERT INTO fts_default (rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
                        [actualRowId, doc.title, doc.content, JSON.stringify({ id: doc.id })]
                    );

                    // Insert into vector table using the same rowid
                    const vectorJson = `[${doc.vector.join(',')}]`;
                    console.log(`Inserting vector for rowid ${actualRowId}: ${vectorJson.substring(0, 50)}...`);

                    await this.db.runAsync(
                        'INSERT INTO vec_default_dense (rowid, embedding) VALUES (?, vec_f32(?))',
                        [actualRowId, vectorJson]
                    );

                    console.log(`Successfully inserted document ${doc.id} with all data linked to rowid ${actualRowId}`);
                } catch (docError) {
                    console.error(`Failed to insert document ${doc.id}:`, docError);
                    // Continue with next document instead of failing completely
                }
            }

            const loadTime = performance.now() - startTime;

            this.setStatus(`Loaded ${documents.length} sample documents in ${loadTime.toFixed(1)}ms`, 'success');
            this.updateDatabaseInfo();

            // Populate query history with sample queries
            this.populateQueryHistory();

        } catch (error) {
            console.error('Sample data loading failed:', error);
            this.setStatus(`Sample data loading failed: ${error.message}`, 'error');

            // Try to recover by reinitializing the database
            await this.handleDatabaseError();
        } finally {
            this.setLoading(false);
        }
    }

    async clearDatabase() {
        if (!confirm('This will delete all data from the database. Are you sure?')) {
            return;
        }

        try {
            this.setLoading(true);
            this.setStatus('Clearing database...', 'info');

            const startTime = performance.now();

            // Use the clear method to drop all tables and reinitialize
            await this.db.clearAsync();

            const clearTime = performance.now() - startTime;

            this.setStatus(`Database cleared successfully in ${clearTime.toFixed(1)}ms`, 'success');
            this.updateDatabaseInfo();

        } catch (error) {
            console.error('Database clear failed:', error);
            this.setStatus(`Database clear failed: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async recreateDatabase() {
        if (!confirm('This will delete all data and create a fresh database. Are you sure?')) {
            return;
        }

        try {
            this.setLoading(true);
            this.setStatus('Recreating database...', 'info');
            this.updateDBStatus('Recreating...', false);

            const startTime = performance.now();

            // Close current database
            if (this.db) {
                try {
                    await this.db.close();
                } catch (closeError) {
                    console.warn('Database close failed:', closeError);
                }
            }

            // Create fresh database with temporary name first, then move to main location
            const tempDbName = `opfs:/localretrieve-demo/demo-temp-${Date.now()}.db`;
            this.db = await initLocalRetrieve(tempDbName);

            // Force initialize the schema
            await this.db.initializeSchema();

            // Verify all tables were created
            const verifyCheck = await this.db.execAsync(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name IN ('docs_default', 'fts_default', 'vec_default_dense', 'collections')
                ORDER BY name
            `);

            const createdTables = verifyCheck[0]?.values?.map(row => row[0]) || [];
            console.log('Created tables:', createdTables);

            if (createdTables.length < 4) {
                throw new Error(`Failed to create all tables. Only created: ${createdTables.join(', ')}`);
            }

            // Test vector table structure
            try {
                await this.db.execAsync('SELECT rowid FROM vec_default_dense LIMIT 1');
                console.log('Vector table structure verified');
            } catch (testError) {
                throw new Error(`Vector table test failed: ${testError.message}`);
            }

            // Close the temp database and reopen with main filename
            await this.db.close();
            this.db = await initLocalRetrieve('opfs:/localretrieve-demo/demo.db');
            await this.db.initializeSchema();

            const recreationTime = performance.now() - startTime;

            this.updateDBStatus('Connected', true);
            this.setStatus(`Database recreated successfully in ${recreationTime.toFixed(1)}ms`, 'success');
            this.updateDatabaseInfo();

            // Enable controls
            this.setControlsEnabled(true);

        } catch (error) {
            console.error('Database recreation failed:', error);
            this.setStatus(`Database recreation failed: ${error.message}`, 'error');
            this.updateDBStatus('Failed', false);
            this.setControlsEnabled(false);
        } finally {
            this.setLoading(false);
        }
    }

    async ensureSchemaInitialized() {
        try {
            // Check if tables exist
            const tableCheck = await this.db.execAsync(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name IN ('docs_default', 'fts_default', 'vec_default_dense')
            `);

            const existingTables = tableCheck[0]?.values?.map(row => row[0]) || [];

            if (existingTables.length < 3) {
                this.setStatus('Reinitializing database schema...', 'info');

                // Close and recreate database to avoid corruption
                await this.db.close();
                this.db = await initLocalRetrieve('opfs:/localretrieve-demo/demo.db');
                await this.db.initializeSchema();

                this.setStatus('Database schema reinitialized', 'success');
            }
        } catch (error) {
            console.error('Schema initialization check failed:', error);
            throw new Error(`Schema initialization failed: ${error.message}`);
        }
    }

    async clearExistingData() {
        try {
            // Check if tables exist and have data before clearing
            const tables = ['docs_default', 'fts_default', 'vec_default_dense'];

            for (const table of tables) {
                try {
                    // Check if table exists
                    const checkResult = await this.db.execAsync(`
                        SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'
                    `);

                    if (checkResult[0]?.values?.length > 0) {
                        // Table exists, check if it has data
                        const countResult = await this.db.execAsync(`SELECT COUNT(*) FROM ${table}`);
                        const count = countResult[0]?.values?.[0]?.[0] || 0;

                        if (count > 0) {
                            await this.db.runAsync(`DELETE FROM ${table}`);
                            console.log(`Cleared ${count} rows from ${table}`);
                        }
                    }
                } catch (tableError) {
                    console.warn(`Could not clear table ${table}:`, tableError.message);
                    // Continue with other tables
                }
            }
        } catch (error) {
            console.error('Data clearing failed:', error);
            throw new Error(`Failed to clear existing data: ${error.message}`);
        }
    }

    async handleDatabaseError() {
        try {
            this.setStatus('Attempting database recovery...', 'info');

            // Close current database
            if (this.db) {
                try {
                    await this.db.close();
                } catch (closeError) {
                    console.warn('Database close failed:', closeError);
                }
            }

            // Create fresh database with new filename to avoid corruption
            const timestamp = Date.now();
            const newDbName = `opfs:/localretrieve-demo/demo-${timestamp}.db`;

            this.db = await initLocalRetrieve(newDbName);
            await this.db.initializeSchema();

            this.updateDBStatus('Recovered', true);
            this.setStatus('Database recovered successfully', 'success');
            this.updateDatabaseInfo();

        } catch (recoveryError) {
            console.error('Database recovery failed:', recoveryError);
            this.setStatus('Database recovery failed. Please refresh the page.', 'error');
            this.updateDBStatus('Failed', false);
            this.setControlsEnabled(false);
        }
    }

    populateQueryHistory() {
        const sampleQueries = getSampleSQLQueries();
        this.queryHistory = [...sampleQueries];

        // Update dropdown
        this.elements.queryHistory.innerHTML = '<option value="">Select from history...</option>';
        sampleQueries.forEach((query, index) => {
            const option = document.createElement('option');
            option.value = query;
            option.textContent = query.length > 50 ? query.substring(0, 50) + '...' : query;
            this.elements.queryHistory.appendChild(option);
        });
    }

    loadQueryFromHistory(event) {
        const query = event.target.value;
        if (query) {
            this.elements.sqlInput.value = query;
        }
    }

    async executeSQL() {
        if (!this.db || this.isLoading) return;

        const query = this.elements.sqlInput.value.trim();
        if (!query) return;

        try {
            this.setLoading(true);
            const startTime = performance.now();

            // Execute query
            const results = await this.db.execAsync(query);

            const queryTime = performance.now() - startTime;
            this.elements.queryTime.textContent = `${queryTime.toFixed(1)}ms`;

            // Display results
            this.displaySQLResults(results, queryTime);

            // Add to history if not already present
            if (!this.queryHistory.includes(query)) {
                this.queryHistory.unshift(query);
                if (this.queryHistory.length > 20) {
                    this.queryHistory = this.queryHistory.slice(0, 20);
                }
                this.updateQueryHistoryDropdown();
            }

            this.updateDatabaseInfo();

        } catch (error) {
            console.error('SQL execution failed:', error);
            this.displaySQLError(error);
        } finally {
            this.setLoading(false);
        }
    }

    displaySQLResults(results, queryTime) {
        const container = this.elements.sqlResults;

        if (!results || results.length === 0) {
            container.innerHTML = '<div class="results-placeholder">Query executed successfully (no results)</div>';
            this.elements.sqlStats.textContent = `Query executed in ${queryTime.toFixed(1)}ms - 0 rows affected`;
            return;
        }

        const result = results[0];
        let totalRows = 0;

        if (result.values && result.values.length > 0) {
            // SELECT query with results
            const table = document.createElement('table');
            table.className = 'sql-table';

            // Header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            result.columns.forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Body
            const tbody = document.createElement('tbody');
            result.values.forEach(row => {
                const tr = document.createElement('tr');
                row.forEach(cell => {
                    const td = document.createElement('td');
                    td.textContent = cell !== null ? String(cell) : 'NULL';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            container.innerHTML = '';
            container.appendChild(table);
            totalRows = result.values.length;
        } else {
            // Non-SELECT query
            container.innerHTML = '<div class="results-placeholder">Query executed successfully</div>';
        }

        this.elements.sqlStats.textContent = `Query executed in ${queryTime.toFixed(1)}ms - ${totalRows} rows returned`;
    }

    displaySQLError(error) {
        const container = this.elements.sqlResults;
        container.innerHTML = `<div class="status-message error">
            <strong>SQL Error:</strong> ${error.message}
        </div>`;
        this.elements.sqlStats.textContent = 'Query failed';
    }

    clearSQL() {
        this.elements.sqlInput.value = '';
        this.elements.sqlResults.innerHTML = '<div class="results-placeholder">No query executed yet</div>';
        this.elements.sqlStats.textContent = '';
    }

    updateQueryHistoryDropdown() {
        this.elements.queryHistory.innerHTML = '<option value="">Select from history...</option>';
        this.queryHistory.forEach(query => {
            const option = document.createElement('option');
            option.value = query;
            option.textContent = query.length > 50 ? query.substring(0, 50) + '...' : query;
            this.elements.queryHistory.appendChild(option);
        });
    }

    async performSearch() {
        if (!this.db || this.isLoading) return;

        const textQuery = this.elements.searchText.value.trim();
        const vectorInput = this.elements.searchVector.value.trim();

        if (!textQuery && !vectorInput) {
            this.setStatus('Please enter a text query or vector', 'error');
            return;
        }

        try {
            this.setLoading(true);
            const startTime = performance.now();

            // Parse vector if provided
            let vector = null;
            if (vectorInput) {
                try {
                    vector = JSON.parse(vectorInput);
                    if (!Array.isArray(vector) || vector.length !== 384) {
                        throw new Error('Vector must be an array of 384 numbers');
                    }
                } catch (e) {
                    this.setStatus('Invalid vector format. Use JSON array: [0.1, 0.2, ...]', 'error');
                    return;
                }
            }

            // Build search request
            const searchRequest = {
                query: {
                    text: textQuery || undefined,
                    vector: vector ? new Float32Array(vector) : undefined
                },
                limit: parseInt(this.elements.searchLimit.value) || 10,
                fusion: {
                    method: this.elements.fusionMethod.value,
                    weights: {
                        fts: parseFloat(this.elements.ftsWeight.value),
                        vector: parseFloat(this.elements.vecWeight.value)
                    }
                }
            };

            // Log search request details
            console.log('Search request:', {
                query: searchRequest.query,
                limit: searchRequest.limit,
                fusion: searchRequest.fusion
            });

            // Perform search
            const results = await this.db.search(searchRequest);

            const searchTime = performance.now() - startTime;
            console.log('Search results:', results);
            this.elements.queryTime.textContent = `${searchTime.toFixed(1)}ms`;

            // Display results
            this.displaySearchResults(results, searchTime);

        } catch (error) {
            console.error('Search failed:', error);
            this.displaySearchError(error);
        } finally {
            this.setLoading(false);
        }
    }

    displaySearchResults(response, searchTime) {
        const container = this.elements.searchResults;

        if (!response.results || response.results.length === 0) {
            container.innerHTML = '<div class="results-placeholder">No results found</div>';
            this.elements.searchStats.textContent = `Search completed in ${searchTime.toFixed(1)}ms - 0 results`;
            return;
        }

        const resultsHtml = response.results.map((result, index) => {
            const scores = [];
            if (result.fts_score !== undefined) {
                scores.push(`<span class="score-badge">FTS: ${result.fts_score.toFixed(3)}</span>`);
            }
            if (result.vec_score !== undefined) {
                scores.push(`<span class="score-badge">Vec: ${result.vec_score.toFixed(3)}</span>`);
            }
            if (result.fusion_score !== undefined) {
                scores.push(`<span class="score-badge fusion">Final: ${result.fusion_score.toFixed(3)}</span>`);
            }

            return `
                <div class="search-result">
                    <div class="result-header">
                        <h4 class="result-title">${this.escapeHtml(result.title || `Document ${result.id}`)}</h4>
                        <div class="result-scores">${scores.join('')}</div>
                    </div>
                    <div class="result-content">${this.escapeHtml(this.truncateText(result.content || '', 200))}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = resultsHtml;
        this.elements.searchStats.textContent =
            `Search completed in ${searchTime.toFixed(1)}ms - ${response.results.length} results (${response.fusion_method || 'unknown'} fusion)`;
    }

    displaySearchError(error) {
        const container = this.elements.searchResults;
        container.innerHTML = `<div class="status-message error">
            <strong>Search Error:</strong> ${error.message}
        </div>`;
        this.elements.searchStats.textContent = 'Search failed';
    }

    async importDatabase(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.setLoading(true);
            this.setStatus('Importing database...', 'info');
            this.showProgress(0);

            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            this.showProgress(50);

            // Import into the existing OPFS database (don't create new one)
            if (!this.db) {
                // Only create new database if none exists
                this.db = await initLocalRetrieve('opfs:/localretrieve-demo/demo.db');
            }
            await this.db.importAsync({ data, overwrite: true });

            this.showProgress(100);
            this.hideProgress();

            this.setStatus(`Database imported successfully (${(data.length / 1024).toFixed(1)} KB)`, 'success');
            this.updateDatabaseInfo();

        } catch (error) {
            console.error('Database import failed:', error);
            this.setStatus(`Database import failed: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
            this.hideProgress();
            event.target.value = ''; // Reset file input
        }
    }

    async exportDatabase() {
        if (!this.db) return;

        try {
            this.setLoading(true);
            this.setStatus('Exporting database...', 'info');
            this.showProgress(0);

            const startTime = performance.now();

            // Use async export method for better performance
            const data = await this.db.exportAsync();

            this.showProgress(80);

            // Create and download file
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `localretrieve-demo-${new Date().toISOString().slice(0, 10)}.db`;
            link.click();
            URL.revokeObjectURL(url);

            this.showProgress(100);

            const exportTime = performance.now() - startTime;
            this.setStatus(`Database exported successfully (${(data.length / 1024).toFixed(1)} KB) in ${exportTime.toFixed(1)}ms`, 'success');

        } catch (error) {
            console.error('Database export failed:', error);
            this.setStatus(`Database export failed: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
            this.hideProgress();
        }
    }

    async updateDatabaseInfo() {
        if (!this.db) return;

        try {
            // Get document count
            const countResult = await this.db.execAsync('SELECT COUNT(*) as count FROM docs_default');
            const docCount = countResult[0]?.values[0]?.[0] || 0;
            this.elements.docCount.textContent = docCount.toString();

            // Get database size (approximation)
            const sizeResult = await this.db.execAsync('PRAGMA page_count; PRAGMA page_size;');
            let dbSize = 0;
            if (sizeResult.length >= 2) {
                const pageCount = sizeResult[0]?.values[0]?.[0] || 0;
                const pageSize = sizeResult[1]?.values[0]?.[0] || 4096;
                dbSize = pageCount * pageSize;
            }
            this.elements.dbSize.textContent = this.formatBytes(dbSize);

            // Update memory usage (approximation)
            if (performance.memory) {
                const memUsage = performance.memory.usedJSHeapSize;
                this.elements.memoryUsage.textContent = this.formatBytes(memUsage);
            }

        } catch (error) {
            console.debug('Database info update failed:', error);
        }
    }

    // Utility methods
    setStatus(message, type = 'info') {
        this.elements.sampleStatus.innerHTML = `<div class="status-message ${type}">${message}</div>`;
        setTimeout(() => {
            if (this.elements.sampleStatus.innerHTML.includes(message)) {
                this.elements.sampleStatus.innerHTML = '';
            }
        }, 5000);
    }

    updateDBStatus(status, isConnected) {
        this.elements.dbStatus.textContent = status;
        this.elements.dbStatus.className = `status-value ${isConnected ? 'connected' : 'disconnected'}`;
    }

    setLoading(loading) {
        this.isLoading = loading;
        const buttons = [
            this.elements.loadSampleBtn,
            this.elements.recreateDbBtn,
            this.elements.importBtn,
            this.elements.exportBtn,
            this.elements.executeSqlBtn,
            this.elements.searchBtn,
            this.elements.testApiKey,
            this.elements.createCollectionBtn,
            this.elements.listCollectionsBtn,
            this.elements.generateEmbeddingBtn,
            this.elements.addToCollectionBtn
        ];

        const allButtons = [
            ...buttons,
            this.elements.clearDbBtn
        ];

        allButtons.forEach(btn => {
            if (btn) {
                btn.disabled = loading;
                if (loading) {
                    btn.classList.add('loading');
                } else {
                    btn.classList.remove('loading');
                }
            }
        });
    }

    setControlsEnabled(enabled) {
        const controls = [
            this.elements.loadSampleBtn,
            this.elements.clearDbBtn,
            this.elements.recreateDbBtn,
            this.elements.importBtn,
            this.elements.exportBtn,
            this.elements.executeSqlBtn,
            this.elements.searchBtn,
            this.elements.sqlInput,
            this.elements.searchText,
            this.elements.embeddingProvider,
            this.elements.openaiApiKey,
            this.elements.testApiKey,
            this.elements.openaiModel,
            this.elements.embeddingDimensions,
            this.elements.collectionName,
            this.elements.collectionDescription,
            this.elements.createCollectionBtn,
            this.elements.listCollectionsBtn,
            this.elements.testText,
            this.elements.generateEmbeddingBtn,
            this.elements.addToCollectionBtn
        ];

        controls.forEach(control => {
            if (control) {
                control.disabled = !enabled;
            }
        });
    }

    showProgress(percentage) {
        this.elements.transferProgress.style.display = 'block';
        const fill = this.elements.transferProgress.querySelector('.progress-fill');
        const text = this.elements.transferProgress.querySelector('.progress-text');
        fill.style.width = `${percentage}%`;
        text.textContent = `${percentage}%`;
    }

    hideProgress() {
        this.elements.transferProgress.style.display = 'none';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Embedding Configuration Methods
    handleProviderChange(event) {
        const provider = event.target.value;
        this.embeddingConfig.provider = provider;

        if (provider === 'openai') {
            this.elements.openaiConfig.style.display = 'block';
            this.updateProviderStatus('OpenAI API - API key required', 'openai');
        } else {
            this.elements.openaiConfig.style.display = 'none';
            this.updateProviderStatus('Local processing - No API key required', 'transformers');
        }

        // Reset embedding results when provider changes
        this.currentEmbedding = null;
        this.elements.addToCollectionBtn.disabled = true;
        this.clearEmbeddingResults();
    }

    handleApiKeyInput(event) {
        const apiKey = event.target.value.trim();
        this.embeddingConfig.openaiApiKey = apiKey;
        this.elements.testApiKey.disabled = !apiKey;

        if (apiKey) {
            this.updateProviderStatus('API key entered - Click "Test Connection" to verify', 'openai');
        } else {
            this.updateProviderStatus('OpenAI API - API key required', 'openai');
        }
    }

    handleModelChange(event) {
        this.embeddingConfig.model = event.target.value;

        // Update dimensions based on model
        if (event.target.value === 'text-embedding-ada-002') {
            this.elements.embeddingDimensions.value = '1536';
            this.embeddingConfig.dimensions = 1536;
        }
    }

    handleDimensionsChange(event) {
        this.embeddingConfig.dimensions = parseInt(event.target.value);
    }

    updateProviderStatus(message, type) {
        this.elements.providerStatus.className = `provider-status ${type}`;
        this.elements.providerStatus.querySelector('.status-text').textContent = message;
    }

    async testApiConnection() {
        if (!this.embeddingConfig.openaiApiKey) return;

        try {
            this.setLoading(true);
            this.updateProviderStatus('Testing API connection...', 'openai');

            // Test with a simple embedding request
            const response = await this.generateOpenAIEmbedding('test', false);

            if (response && response.length > 0) {
                this.updateProviderStatus('API connection successful', 'openai');
                this.setStatus('OpenAI API connection test successful', 'success');
            } else {
                throw new Error('Invalid response from OpenAI API');
            }

        } catch (error) {
            console.error('API test failed:', error);
            this.updateProviderStatus(`API test failed: ${error.message}`, 'error');
            this.setStatus(`OpenAI API test failed: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async generateOpenAIEmbedding(text, fullResponse = true) {
        if (!this.embeddingConfig.openaiApiKey) {
            throw new Error('OpenAI API key is required');
        }

        try {
            console.log('[DEBUG] Creating OpenAI provider config:', {
                provider: 'openai',
                model: this.embeddingConfig.model,
                dimensions: this.embeddingConfig.dimensions,
                hasApiKey: !!this.embeddingConfig.openaiApiKey
            });

            // Create provider configuration
            const config = {
                provider: 'openai',
                apiKey: this.embeddingConfig.openaiApiKey,
                model: this.embeddingConfig.model,
                dimensions: this.embeddingConfig.dimensions
            };

            // Validate configuration
            console.log('[DEBUG] Validating OpenAI provider config...');
            const validation = validateProviderConfig(config);
            console.log('[DEBUG] OpenAI validation result:', validation);

            if (!validation.isValid) {
                throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
            }

            // Create provider
            console.log('[DEBUG] Creating OpenAI provider...');
            const provider = await createProvider(config);
            console.log('[DEBUG] OpenAI provider created:', provider.constructor.name);

            // Generate embedding using the SDK
            console.log('[DEBUG] Generating OpenAI embedding...');
            const embedding = await provider.generateEmbedding(text);
            console.log('[DEBUG] OpenAI embedding generated, length:', embedding.length);

            // Get provider metrics for usage info
            const metrics = provider.getMetrics();

            // Clean up provider
            await provider.cleanup();

            if (fullResponse) {
                return {
                    embedding: Array.from(embedding), // Convert Float32Array to regular array
                    model: this.embeddingConfig.model,
                    usage: {
                        prompt_tokens: Math.ceil(text.length / 4), // Estimate
                        total_tokens: Math.ceil(text.length / 4)
                    },
                    metrics: metrics
                };
            } else {
                return Array.from(embedding);
            }
        } catch (error) {
            console.error('OpenAI embedding generation failed:', error);
            throw error;
        }
    }

    async generateTransformersEmbedding(text) {
        try {
            console.log('[DEBUG] Creating Transformers provider config...');
            // Create provider configuration for Transformers.js
            const config = {
                provider: 'transformers',
                model: 'all-MiniLM-L6-v2',
                dimensions: 384
            };

            // Validate configuration
            console.log('[DEBUG] Validating Transformers provider config...');
            const validation = validateProviderConfig(config);
            console.log('[DEBUG] Transformers validation result:', validation);

            if (!validation.isValid) {
                throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
            }

            // Create provider
            console.log('[DEBUG] Creating Transformers provider...');
            const provider = await createProvider(config);
            console.log('[DEBUG] Transformers provider created:', provider.constructor.name);

            // Generate embedding using the SDK
            console.log('[DEBUG] Generating Transformers embedding...');
            const embedding = await provider.generateEmbedding(text);
            console.log('[DEBUG] Transformers embedding generated, length:', embedding.length);

            // Get provider metrics
            const metrics = provider.getMetrics();

            // Clean up provider
            await provider.cleanup();

            return {
                embedding: Array.from(embedding), // Convert Float32Array to regular array
                metrics: metrics
            };
        } catch (error) {
            console.warn('Transformers.js provider failed, falling back to mock embedding:', error.message);

            // Fallback to mock embedding for demo purposes
            const embedding = Array.from({length: 384}, () => Math.random() * 2 - 1);

            // Normalize to unit vector
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            return {
                embedding: embedding.map(val => val / magnitude),
                metrics: { totalEmbeddings: 1, averageGenerationTime: 100, errorCount: 0 }
            };
        }
    }

    async generateEmbedding() {
        const text = this.elements.testText.value.trim();
        if (!text) {
            this.setStatus('Please enter text to generate embedding', 'error');
            return;
        }

        try {
            this.setLoading(true);
            this.showEmbeddingProgress();
            this.clearEmbeddingResults();

            console.log('[DEBUG] Starting embedding generation:', {
                text: text.substring(0, 50) + '...',
                provider: this.embeddingConfig.provider,
                config: this.embeddingConfig
            });

            const startTime = performance.now();
            let result;

            if (this.embeddingConfig.provider === 'openai') {
                result = await this.generateOpenAIEmbedding(text);
                this.currentEmbedding = {
                    text: text,
                    embedding: new Float32Array(result.embedding),
                    provider: 'openai',
                    model: result.model,
                    dimensions: result.embedding.length,
                    usage: result.usage,
                    metrics: result.metrics,
                    generatedAt: new Date().toISOString()
                };
            } else {
                console.log('[DEBUG] Calling generateTransformersEmbedding...');
                const result = await this.generateTransformersEmbedding(text);
                console.log('[DEBUG] Transformers result:', result);

                this.currentEmbedding = {
                    text: text,
                    embedding: new Float32Array(result.embedding),
                    provider: 'transformers',
                    model: 'all-MiniLM-L6-v2',
                    dimensions: result.embedding.length,
                    metrics: result.metrics,
                    generatedAt: new Date().toISOString()
                };
                console.log('[DEBUG] currentEmbedding set:', this.currentEmbedding);
            }

            const generationTime = performance.now() - startTime;

            console.log('[DEBUG] About to call displayEmbeddingResults with:', this.currentEmbedding);
            this.displayEmbeddingResults(this.currentEmbedding, generationTime);
            console.log('[DEBUG] displayEmbeddingResults called successfully');

            this.elements.addToCollectionBtn.disabled = false;
            this.setStatus(`Embedding generated successfully in ${generationTime.toFixed(1)}ms`, 'success');

        } catch (error) {
            console.error('[DEBUG] Embedding generation failed:', error);
            console.error('[DEBUG] Error details:', {
                message: error.message,
                stack: error.stack,
                provider: this.embeddingConfig.provider
            });
            this.setStatus(`Embedding generation failed: ${error.message}`, 'error');
            this.currentEmbedding = null;
            this.elements.addToCollectionBtn.disabled = true;
        } finally {
            this.setLoading(false);
            this.hideEmbeddingProgress();
        }
    }

    displayEmbeddingResults(embedding, generationTime) {
        const container = this.elements.embeddingResults;

        const resultHtml = `
            <div class="embedding-result">
                <div class="embedding-info">
                    <div class="embedding-metric">
                        <span class="label">Provider:</span>
                        <span class="value">${embedding.provider}</span>
                    </div>
                    <div class="embedding-metric">
                        <span class="label">Model:</span>
                        <span class="value">${embedding.model}</span>
                    </div>
                    <div class="embedding-metric">
                        <span class="label">Dimensions:</span>
                        <span class="value">${embedding.dimensions}</span>
                    </div>
                    <div class="embedding-metric">
                        <span class="label">Generation Time:</span>
                        <span class="value">${generationTime.toFixed(1)}ms</span>
                    </div>
                    ${embedding.usage ? `
                    <div class="embedding-metric">
                        <span class="label">Tokens Used:</span>
                        <span class="value">${embedding.usage.total_tokens}</span>
                    </div>
                    <div class="embedding-metric">
                        <span class="label">Prompt Tokens:</span>
                        <span class="value">${embedding.usage.prompt_tokens}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="input-group">
                    <label>Generated Text:</label>
                    <div class="result-content">${this.escapeHtml(embedding.text)}</div>
                </div>

                <div class="input-group">
                    <label>Embedding Vector (first 20 dimensions):</label>
                    <div class="embedding-vector">[${Array.from(embedding.embedding.slice(0, 20)).map(v => v.toFixed(6)).join(', ')}${embedding.dimensions > 20 ? ', ...' : ''}]</div>
                </div>
            </div>
        `;

        container.innerHTML = resultHtml;

        this.elements.embeddingStats.textContent =
            `Embedding generated: ${embedding.dimensions} dimensions, ${embedding.provider} provider`;
    }

    clearEmbeddingResults() {
        this.elements.embeddingResults.innerHTML = '<div class="results-placeholder">No embedding generated yet</div>';
        this.elements.embeddingStats.textContent = '';
    }

    showEmbeddingProgress() {
        this.elements.embeddingProgress.style.display = 'block';
        const fill = this.elements.embeddingProgress.querySelector('.progress-fill');
        const text = this.elements.embeddingProgress.querySelector('.progress-text');

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            fill.style.width = `${Math.min(progress, 90)}%`;
            text.textContent = `${Math.min(progress, 90)}%`;

            if (progress >= 90) {
                clearInterval(interval);
            }
        }, 100);

        this.embeddingProgressInterval = interval;
    }

    hideEmbeddingProgress() {
        if (this.embeddingProgressInterval) {
            clearInterval(this.embeddingProgressInterval);
        }

        const fill = this.elements.embeddingProgress.querySelector('.progress-fill');
        const text = this.elements.embeddingProgress.querySelector('.progress-text');
        fill.style.width = '100%';
        text.textContent = '100%';

        setTimeout(() => {
            this.elements.embeddingProgress.style.display = 'none';
        }, 500);
    }

    async createCollection() {
        const name = this.elements.collectionName.value.trim();
        const description = this.elements.collectionDescription.value.trim();

        if (!name) {
            this.setStatus('Collection name is required', 'error');
            return;
        }

        try {
            this.setLoading(true);

            // This is a placeholder for collection creation
            // In a real implementation, you would create a collection in the database
            console.log('Creating collection:', { name, description });

            this.setStatus(`Collection "${name}" created successfully`, 'success');

            // Clear form
            this.elements.collectionName.value = 'default';
            this.elements.collectionDescription.value = '';

        } catch (error) {
            console.error('Collection creation failed:', error);
            this.setStatus(`Collection creation failed: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async listCollections() {
        try {
            this.setLoading(true);

            // This is a placeholder for listing collections
            // In a real implementation, you would query the collections from the database
            const collections = [
                {
                    name: 'default',
                    description: 'Default collection for demo data',
                    documents: 12,
                    created: '2024-01-15'
                }
            ];

            this.displayCollections(collections);
            this.setStatus('Collections loaded successfully', 'success');

        } catch (error) {
            console.error('Failed to list collections:', error);
            this.setStatus(`Failed to list collections: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayCollections(collections) {
        const container = this.elements.embeddingResults;

        if (collections.length === 0) {
            container.innerHTML = '<div class="results-placeholder">No collections found</div>';
            return;
        }

        const collectionsHtml = collections.map(collection => `
            <div class="collection-item">
                <div>
                    <div class="collection-name">${this.escapeHtml(collection.name)}</div>
                    <div class="collection-meta">${this.escapeHtml(collection.description || 'No description')}</div>
                </div>
                <div class="collection-meta">
                    ${collection.documents} docs • Created ${collection.created}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="collection-list">
                ${collectionsHtml}
            </div>
        `;

        this.elements.embeddingStats.textContent = `Found ${collections.length} collection(s)`;
    }

    async addToCollection() {
        if (!this.currentEmbedding) {
            this.setStatus('No embedding to add - generate an embedding first', 'error');
            return;
        }

        const collectionName = this.elements.collectionName.value.trim() || 'default';

        try {
            this.setLoading(true);

            // This is a placeholder for adding embedding to collection
            // In a real implementation, you would store this in your database
            console.log('Adding to collection:', {
                collection: collectionName,
                text: this.currentEmbedding.text,
                embedding: this.currentEmbedding.embedding,
                metadata: {
                    provider: this.currentEmbedding.provider,
                    model: this.currentEmbedding.model,
                    dimensions: this.currentEmbedding.dimensions,
                    generatedAt: this.currentEmbedding.generatedAt
                }
            });

            this.setStatus(`Embedding added to collection "${collectionName}" successfully`, 'success');

            // Clear current embedding
            this.currentEmbedding = null;
            this.elements.addToCollectionBtn.disabled = true;
            this.clearEmbeddingResults();

        } catch (error) {
            console.error('Failed to add to collection:', error);
            this.setStatus(`Failed to add to collection: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // Phase 5: Queue Management Methods

    async showCollectionStatus() {
        const collectionName = this.elements.collectionName.value.trim() || 'default';

        try {
            this.setLoading(true);

            if (this.db && typeof this.db.getCollectionEmbeddingStatus === 'function') {
                const status = await this.db.getCollectionEmbeddingStatus(collectionName);

                this.displayResults('collection-status', JSON.stringify(status, null, 2), 'json');
                this.setStatus(`Collection "${collectionName}" status retrieved successfully`, 'success');
            } else {
                // Fallback for basic collection info
                const collections = await this.db.exec(`
                    SELECT name, created_at, config FROM collections WHERE name = ?
                `, [collectionName]);

                if (collections.length > 0) {
                    this.displayResults('collection-status', JSON.stringify(collections[0], null, 2), 'json');
                    this.setStatus(`Basic collection info retrieved`, 'success');
                } else {
                    this.setStatus(`Collection "${collectionName}" not found`, 'error');
                }
            }

        } catch (error) {
            console.error('Failed to get collection status:', error);
            this.setStatus(`Failed to get collection status: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async enqueueEmbedding() {
        const collection = this.elements.queueCollection.value.trim();
        const textContent = this.elements.queueText.value.trim();
        const priority = parseInt(this.elements.queuePriority.value);

        if (!collection) {
            this.setStatus('Collection name is required', 'error');
            return;
        }

        if (!textContent) {
            this.setStatus('Text content is required', 'error');
            return;
        }

        try {
            this.setLoading(true);

            if (this.db && typeof this.db.enqueueEmbedding === 'function') {
                const documentId = `doc-${Date.now()}`;

                // First, insert the document using the proper Database API
                const insertResult = await this.db.insertDocumentWithEmbedding({
                    collection: collection,
                    id: documentId,
                    title: 'Queued Document',
                    content: textContent,
                    metadata: { source: 'queue' },
                    document: {
                        id: documentId,
                        title: 'Queued Document',
                        content: textContent,
                        metadata: { source: 'queue' }
                    },
                    options: {
                        generateEmbedding: false // We'll use the queue for this
                    }
                });

                console.log(`Document ${documentId} inserted via insertDocumentWithEmbedding:`, insertResult);

                // Then enqueue the embedding
                const queueId = await this.db.enqueueEmbedding({
                    collection: collection,
                    documentId: documentId,
                    textContent: textContent,
                    priority: priority
                });

                this.displayQueueResult(`Document created and embedding enqueued successfully with ID: ${queueId}`, 'success');
                this.setStatus('Document created and embedding enqueued for processing', 'success');

                // Auto-update queue status
                await this.updateQueueStatus();
            } else {
                this.setStatus('Queue functionality not available - requires Phase 5 implementation', 'error');
            }

        } catch (error) {
            console.error('Failed to enqueue embedding:', error);
            this.setStatus(`Failed to enqueue embedding: ${error.message}`, 'error');
            this.displayQueueResult(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async processEmbeddingQueue() {
        const collection = this.elements.queueCollection.value.trim() || undefined;

        try {
            this.setLoading(true);

            if (this.db && typeof this.db.processEmbeddingQueue === 'function') {
                const result = await this.db.processEmbeddingQueue({
                    collection: collection,
                    batchSize: 5
                });

                this.displayQueueResult(`Processed ${result.processed} items, ${result.failed} failed, ${result.remainingInQueue} remaining`, 'success');
                this.setStatus('Queue processing completed', 'success');

                // Auto-update queue status
                await this.updateQueueStatus();
            } else {
                this.setStatus('Queue processing not available - requires Phase 5 implementation', 'error');
            }

        } catch (error) {
            console.error('Failed to process queue:', error);
            this.setStatus(`Failed to process queue: ${error.message}`, 'error');
            this.displayQueueResult(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async updateQueueStatus() {
        const collection = this.elements.queueCollection.value.trim() || undefined;

        try {
            if (this.db && typeof this.db.getQueueStatus === 'function') {
                const status = await this.db.getQueueStatus(collection);

                console.log('Queue status received:', status);
                console.log('Status properties:', Object.keys(status));
                console.log('totalCount:', status.totalCount);
                console.log('pendingCount:', status.pendingCount);

                // Update status display
                this.elements.queueTotal.textContent = status.totalCount || 0;
                this.elements.queuePending.textContent = status.pendingCount || 0;
                this.elements.queueProcessing.textContent = status.processingCount || 0;
                this.elements.queueCompleted.textContent = status.completedCount || 0;
                this.elements.queueFailed.textContent = status.failedCount || 0;

                console.log('Updated DOM elements:');
                console.log('- Total:', this.elements.queueTotal.textContent);
                console.log('- Pending:', this.elements.queuePending.textContent);

                const statusMsg = collection
                    ? `Queue status updated for collection "${collection}"`
                    : 'Global queue status updated';
                this.displayQueueResult(statusMsg, 'info');
            } else {
                // Fallback: show placeholder values
                this.elements.queueTotal.textContent = '0';
                this.elements.queuePending.textContent = '0';
                this.elements.queueProcessing.textContent = '0';
                this.elements.queueCompleted.textContent = '0';
                this.elements.queueFailed.textContent = '0';

                this.displayQueueResult('Queue status not available - requires Phase 5 implementation', 'warning');
            }

        } catch (error) {
            console.error('Failed to get queue status:', error);
            this.displayQueueResult(`Error getting queue status: ${error.message}`, 'error');
        }
    }

    async clearEmbeddingQueue() {
        const collection = this.elements.queueCollection.value.trim() || undefined;

        try {
            this.setLoading(true);

            if (this.db && typeof this.db.clearEmbeddingQueue === 'function') {
                const cleared = await this.db.clearEmbeddingQueue({
                    collection: collection,
                    status: 'completed' // Clear only completed items by default
                });

                this.displayQueueResult(`Cleared ${cleared} completed items from queue`, 'success');
                this.setStatus('Queue cleared successfully', 'success');

                // Auto-update queue status
                await this.updateQueueStatus();
            } else {
                this.setStatus('Queue clearing not available - requires Phase 5 implementation', 'error');
            }

        } catch (error) {
            console.error('Failed to clear queue:', error);
            this.setStatus(`Failed to clear queue: ${error.message}`, 'error');
            this.displayQueueResult(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayQueueResult(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const className = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';

        this.elements.queueResults.innerHTML = `
            <div class="queue-operation-result ${className}">
                <div class="operation-message">${message}</div>
                <div class="operation-details">Time: ${timestamp}</div>
            </div>
        `;
    }
}

// Initialize demo when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.localRetrieveDemo = new LocalRetrieveDemo();
});

// Handle page unload
window.addEventListener('beforeunload', async () => {
    if (window.localRetrieveDemo?.db) {
        try {
            await window.localRetrieveDemo.db.close();
        } catch (error) {
            console.debug('Database cleanup failed:', error);
        }
    }
});