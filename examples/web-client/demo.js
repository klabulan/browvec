// LocalRetrieve MVP Demo Application
// Showcases all core functionality with preloaded test data

import { initLocalRetrieve } from '../../dist/localretrieve.mjs';

class LocalRetrieveDemo {
    constructor() {
        this.db = null;
        this.isLoading = false;
        this.queryHistory = [];
        this.searchHistory = [];

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
            searchStats: document.getElementById('search-stats')
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

            // Ensure schema is properly initialized first
            await this.ensureSchemaInitialized();

            // Clear existing data safely
            await this.clearExistingData();

            // Insert sample documents
            for (const doc of documents) {
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
                    'INSERT INTO fts_default (rowid, id, title, content) VALUES (?, ?, ?, ?)',
                    [actualRowId, doc.id, doc.title, doc.content]
                );

                // Insert into vector table using the same rowid
                const vectorJson = `[${doc.vector.join(',')}]`;
                console.log(`Inserting vector for rowid ${actualRowId}: ${vectorJson.substring(0, 50)}...`);

                await this.db.runAsync(
                    'INSERT INTO vec_default_dense (rowid, embedding) VALUES (?, vec_f32(?))',
                    [actualRowId, vectorJson]
                );

                console.log(`Successfully inserted document ${doc.id} with all data linked to rowid ${actualRowId}`);
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
            this.elements.searchBtn
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
            this.elements.searchText
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