# DEMO-001: Web Client Demo Design

## Overview
A comprehensive demo application showcasing LocalRetrieve MVP functionality with preloaded test data.

## UI Layout Design

### Header Section
- **Title**: "LocalRetrieve MVP Demo"
- **Status Indicator**: Database connection status (connected/disconnected)
- **Performance Metrics**: Query time, memory usage

### Main Content Areas (3-column layout)

#### Left Panel: Data Management
1. **Database Info**
   - Current database size
   - Number of indexed documents
   - Storage type (OPFS/Memory)

2. **Import/Export Section**
   - Import database file input
   - Export database button
   - Progress indicators

3. **Test Data Section**
   - "Load Sample Data" button
   - Data status indicator

#### Center Panel: SQL Operations
1. **SQL Query Editor**
   - Textarea for SQL input
   - Execute button
   - Query history dropdown

2. **SQL Results Display**
   - Table format for structured results
   - Raw text for other outputs
   - Row count and execution time

#### Right Panel: Hybrid Search
1. **Search Interface**
   - Text query input
   - Vector input (optional, JSON array format)
   - Search parameters (fusion method, weights)
   - Search button

2. **Search Results Display**
   - Ranked results with scores
   - FTS score, Vector score, Fusion score
   - Document preview/content

## Test Data Specification

### Sample Documents
```javascript
const testDocuments = [
  {
    id: 1,
    title: "Machine Learning Basics",
    content: "Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models...",
    vector: [0.1, 0.2, 0.3, ...] // 384-dimensional embedding
  },
  {
    id: 2,
    title: "Database Systems",
    content: "Relational databases organize data into tables with rows and columns. SQL is the standard language...",
    vector: [0.4, 0.5, 0.6, ...]
  },
  {
    id: 3,
    title: "Web Development",
    content: "Modern web development involves HTML, CSS, and JavaScript. Frameworks like React and Vue...",
    vector: [0.7, 0.8, 0.9, ...]
  }
];
```

### Sample SQL Queries
```sql
-- Basic queries for testing
SELECT COUNT(*) FROM docs_default;
SELECT * FROM docs_default LIMIT 5;
SELECT title, content FROM docs_default WHERE title LIKE '%machine%';

-- FTS queries
SELECT * FROM fts_default WHERE fts_default MATCH 'machine learning';

-- Vector queries
SELECT id, title, vec_distance_cosine(vector, vec_f32('[0.1,0.2,0.3,...]')) as distance
FROM vec_default_dense ORDER BY distance LIMIT 5;
```

## Functionality Requirements

### Core Features
1. **Database Initialization**
   - Auto-connect to database on page load
   - Create default schema if needed
   - Load test data automatically

2. **SQL Operations**
   - Execute arbitrary SQL queries
   - Display results in table format
   - Show execution time and row count
   - Handle errors gracefully

3. **Hybrid Search**
   - Text-only search (FTS5)
   - Vector-only search (with manual vector input)
   - Combined hybrid search with fusion
   - Configurable fusion parameters

4. **Import/Export**
   - Export current database to file
   - Import database from file
   - Progress indicators for large operations

### User Experience Features
1. **Responsive Design**
   - Works on desktop and tablet
   - Collapsible panels on mobile

2. **Performance Monitoring**
   - Real-time query timing
   - Memory usage display
   - Database size tracking

3. **Error Handling**
   - Clear error messages
   - Input validation
   - Graceful degradation

## Technical Implementation

### File Structure
```
examples/web-client/
├── index.html          # Main demo page
├── demo.js            # Demo application logic
├── style.css          # Styling
└── test-data.js       # Test data definitions
```

### Dependencies
- LocalRetrieve SDK (from `/dist/`)
- No external dependencies
- Self-contained demo

### Browser Compatibility
- Modern browsers with OPFS support
- SharedArrayBuffer requirement
- Cross-origin isolation headers needed

## Success Metrics
1. Demo loads in <2 seconds
2. Test data loads successfully
3. All SQL operations work correctly
4. Hybrid search returns relevant results
5. Export/import functionality works
6. UI remains responsive during operations