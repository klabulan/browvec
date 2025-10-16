// Test data for LocalRetrieve MVP Demo
// Sample documents with pre-computed 384-dimensional vectors (simplified for demo)

const TEST_DATA = {
    documents: [
        {
            id: 1,
            title: "Machine Learning Fundamentals",
            content: "Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models that computer systems use to perform tasks without explicit instructions. It relies on patterns and inference instead of traditional programming approaches. Common applications include recommendation systems, image recognition, and natural language processing.",
            vector: generateMockVector([0.8, 0.2, 0.7, 0.1, 0.9]) // ML-related vector
        },
        {
            id: 2,
            title: "Database Systems and SQL",
            content: "Relational databases organize data into tables with rows and columns. SQL (Structured Query Language) is the standard language for managing and querying relational databases. Modern database systems support ACID properties, indexing, and complex query optimization. NoSQL databases provide alternative approaches for specific use cases.",
            vector: generateMockVector([0.1, 0.8, 0.3, 0.9, 0.2]) // Database-related vector
        },
        {
            id: 3,
            title: "Web Development with JavaScript",
            content: "Modern web development involves HTML for structure, CSS for styling, and JavaScript for interactivity. Popular frameworks like React, Vue, and Angular provide component-based architectures. Node.js enables server-side JavaScript development. Progressive Web Apps bridge the gap between web and native applications.",
            vector: generateMockVector([0.3, 0.1, 0.9, 0.6, 0.4]) // Web dev-related vector
        },
        {
            id: 4,
            title: "Artificial Intelligence and Neural Networks",
            content: "Artificial intelligence encompasses machine learning, deep learning, and neural networks. Deep neural networks with multiple layers can learn complex patterns from data. Convolutional neural networks excel at image processing, while recurrent networks handle sequential data. Transformer architectures have revolutionized natural language understanding.",
            vector: generateMockVector([0.9, 0.3, 0.8, 0.2, 0.7]) // AI-related vector
        },
        {
            id: 5,
            title: "Cloud Computing and Distributed Systems",
            content: "Cloud computing provides on-demand access to computing resources including servers, storage, and applications. Major platforms include AWS, Azure, and Google Cloud. Distributed systems handle load balancing, fault tolerance, and scalability. Microservices architecture enables modular application development and deployment.",
            vector: generateMockVector([0.2, 0.7, 0.4, 0.8, 0.5]) // Cloud-related vector
        },
        {
            id: 6,
            title: "Data Science and Analytics",
            content: "Data science combines statistics, programming, and domain expertise to extract insights from data. The data science pipeline includes collection, cleaning, analysis, and visualization. Python and R are popular languages for data analysis. Machine learning models can predict outcomes and classify data patterns.",
            vector: generateMockVector([0.7, 0.4, 0.6, 0.3, 0.8]) // Data science-related vector
        },
        {
            id: 7,
            title: "Cybersecurity and Information Protection",
            content: "Cybersecurity protects digital systems, networks, and data from threats. Common attacks include malware, phishing, and SQL injection. Security measures include encryption, firewalls, and authentication systems. Zero-trust architecture assumes no implicit trust and verifies every transaction.",
            vector: generateMockVector([0.4, 0.6, 0.2, 0.7, 0.9]) // Security-related vector
        },
        {
            id: 8,
            title: "Software Engineering Best Practices",
            content: "Software engineering encompasses design patterns, testing methodologies, and development practices. Version control systems like Git enable collaboration. Continuous integration and deployment automate software delivery. Code reviews, documentation, and refactoring maintain code quality over time.",
            vector: generateMockVector([0.5, 0.9, 0.3, 0.4, 0.6]) // Software engineering-related vector
        },
        {
            id: 9,
            title: "Русская литература и классика",
            content: "Русская литература богата великими произведениями. Александр Пушкин считается основателем современного русского литературного языка. Лев Толстой написал эпические романы Война и мир и Анна Каренина. Фёдор Достоевский исследовал глубины человеческой психологии в произведениях Преступление и наказание и Братья Карамазовы.",
            vector: generateMockVector([0.6, 0.3, 0.8, 0.5, 0.4]) // Literature-related vector
        },
        {
            id: 10,
            title: "История России и культура",
            content: "Российская история охватывает более тысячи лет. Киевская Русь была первым восточнославянским государством. Московское царство объединило русские земли. Российская империя стала одной из великих держав мира. Советский Союз внёс значительный вклад в мировую историю и науку.",
            vector: generateMockVector([0.4, 0.7, 0.5, 0.6, 0.3]) // History-related vector
        },
        {
            id: 11,
            title: "Российские технологии и наука",
            content: "Россия имеет богатые научные традиции. Дмитрий Менделеев создал периодическую таблицу элементов. Константин Циолковский разработал основы космонавтики. Советские учёные запустили первый искусственный спутник Земли и отправили первого человека в космос. Современные российские программисты создают инновационные технологии.",
            vector: generateMockVector([0.8, 0.5, 0.7, 0.4, 0.6]) // Science/tech-related vector
        }
    ],

    sampleQueries: {
        sql: [
            "SELECT COUNT(*) FROM docs_default;",
            "SELECT * FROM docs_default LIMIT 5;",
            "SELECT title, content FROM docs_default WHERE title LIKE '%machine%';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'machine learning';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'database sql';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'web development javascript';",
            "SELECT id, title FROM docs_default ORDER BY id DESC;",
            "SELECT title, LENGTH(content) as content_length FROM docs_default ORDER BY content_length DESC;",
            "SELECT rowid FROM vec_default_dense LIMIT 5;",
            "SELECT COUNT(*) as vec_count FROM vec_default_dense;",
            "SELECT d.rowid, d.id, d.title, v.rowid as vec_rowid FROM docs_default d LEFT JOIN vec_default_dense v ON d.rowid = v.rowid LIMIT 5;",
            "SELECT vec_version() as version;",
            "SELECT vec_f32('[1.0, 2.0, 3.0]') as test_vector;",
            "SELECT embedding FROM vec_default_dense LIMIT 1;",
            "-- Test with small vector (will fail - dimension mismatch)",
            "SELECT rowid, distance FROM vec_default_dense WHERE embedding MATCH '[0.8,0.2,0.7,0.1,0.9]' ORDER BY distance LIMIT 3;",
            "-- Working vector search examples using direct JSON array syntax (no vec_f32 wrapper needed)",
            "-- Use getTestVectorQuery() in browser console to get working 384-dim vector query",
            "-- Use getTestVectorJoinQuery() in browser console to get working vector search with titles",
            "-- Use getExactMatchQuery() in browser console to test with exact vector from test data",
            "-- Example: SELECT rowid, distance FROM vec_default_dense WHERE embedding MATCH '[0.1,0.2,0.3,...]' ORDER BY distance LIMIT 3;",
            "-- Note: sqlite-vec v0.1.7-alpha.2 uses direct JSON array strings, not vec_f32() wrapper",
            "-- Russian/Cyrillic FTS5 search tests (requires unicode61 tokenizer)",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'Пушкин';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'литература';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'Толстой';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'Россия';",
            "SELECT * FROM fts_default WHERE fts_default MATCH 'космос';",
            "SELECT d.title, d.content FROM docs_default d JOIN fts_default f ON d.rowid = f.rowid WHERE fts_default MATCH 'наука' LIMIT 5;"
        ],
        search: [
            { text: "machine learning", vector: null },
            { text: "database systems", vector: null },
            { text: "web development", vector: null },
            { text: "artificial intelligence", vector: null },
            { text: "cloud computing", vector: null },
            // Russian search queries
            { text: "Пушкин", vector: null },
            { text: "литература", vector: null },
            { text: "Толстой", vector: null },
            { text: "Россия", vector: null },
            { text: "космос", vector: null },
            { text: "наука технологии", vector: null }
        ]
    }
};

/**
 * Generate a mock 384-dimensional vector based on seed values
 * This creates realistic-looking vectors for demo purposes
 */
function generateMockVector(seedValues = [0.5, 0.5, 0.5, 0.5, 0.5]) {
    const vector = new Float32Array(384);

    // Use seed values to create patterns in the vector
    for (let i = 0; i < 384; i++) {
        const seedIndex = i % seedValues.length;
        const baseValue = seedValues[seedIndex];

        // Add some randomness while maintaining the seed pattern
        const noise = (Math.random() - 0.5) * 0.3; // ±0.15 random noise
        const cyclical = Math.sin(i * 0.1) * 0.1;   // Small cyclical pattern

        vector[i] = Math.max(-1, Math.min(1, baseValue + noise + cyclical));
    }

    // Normalize the vector (unit length)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < 384; i++) {
        vector[i] = vector[i] / magnitude;
    }

    return Array.from(vector);
}

/**
 * Generate a test vector for similarity search (384-dimensional)
 */
function generateTestVector() {
    return generateMockVector([0.8, 0.2, 0.7, 0.1, 0.9]);
}

/**
 * Get test documents
 */
function getTestDocuments() {
    return TEST_DATA.documents;
}

/**
 * Get sample SQL queries
 */
function getSampleSQLQueries() {
    return TEST_DATA.sampleQueries.sql;
}

/**
 * Get sample search queries
 */
function getSampleSearchQueries() {
    return TEST_DATA.sampleQueries.search;
}

/**
 * Generate a random search vector for testing
 */
function generateRandomSearchVector() {
    return generateMockVector([
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random()
    ]);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TEST_DATA,
        getTestDocuments,
        getSampleSQLQueries,
        getSampleSearchQueries,
        generateRandomSearchVector,
        generateMockVector,
        generateTestVector
    };
}

// Add a function to create a proper test vector query using direct JSON array syntax
function getTestVectorQuery() {
    const testVec = generateTestVector();
    const vectorJson = JSON.stringify(testVec);
    return `SELECT rowid, distance FROM vec_default_dense WHERE embedding MATCH '${vectorJson}' ORDER BY distance LIMIT 3;`;
}

function getTestVectorJoinQuery() {
    const testVec = generateTestVector();
    const vectorJson = JSON.stringify(testVec);
    return `SELECT d.title, v.distance FROM docs_default d JOIN (SELECT rowid, distance FROM vec_default_dense WHERE embedding MATCH '${vectorJson}' ORDER BY distance LIMIT 3) v ON d.rowid = v.rowid ORDER BY v.distance;`;
}

// Create a test query with exact vector from test data
function getExactMatchQuery() {
    // Use the exact vector from first test document for guaranteed match
    const testDoc = TEST_DATA.documents[0];
    const vectorJson = JSON.stringify(testDoc.vector);
    return `SELECT d.title, v.distance FROM docs_default d JOIN (SELECT rowid, distance FROM vec_default_dense WHERE embedding MATCH '${vectorJson}' ORDER BY distance LIMIT 3) v ON d.rowid = v.rowid ORDER BY v.distance;`;
}