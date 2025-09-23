# LocalRetrieve MVP Demo

A comprehensive demonstration of LocalRetrieve's hybrid search capabilities, showcasing SQL operations, vector search, and data persistence features.

## 🚀 Quick Start

### Prerequisites

- Modern web browser with OPFS support (Chrome 86+, Firefox 79+, Safari 15+)
- Local web server (required for SharedArrayBuffer and OPFS)

### Running the Demo

1. **Start the development server** from the project root:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Navigate to the demo**:
   ```
   http://localhost:5173/examples/web-client/
   ```

3. **Load sample data**:
   - Click "Load Sample Data" button in the left panel
   - Wait for 8 test documents to be indexed
   - Status will show "Loaded 8 sample documents"

## 📋 Demo Features

### 🗄️ Data Management (Left Panel)
- **Database Info**: Real-time stats (size, document count, storage type)
- **Import/Export**: Backup and restore database files
- **Sample Data**: Preloaded test documents with vectors

### 🔍 SQL Operations (Center Panel)
- **Query Editor**: Execute arbitrary SQL with syntax highlighting
- **Query History**: Dropdown with sample queries and execution history
- **Results Display**: Formatted tables with execution timing
- **Keyboard Shortcuts**: Ctrl+Enter to execute queries

### 🔎 Hybrid Search (Right Panel)
- **Text Search**: Full-text search using FTS5
- **Vector Search**: 384-dimensional vector similarity
- **Fusion Methods**: Reciprocal Rank Fusion (RRF) or Weighted Linear
- **Configurable Parameters**: Adjustable FTS/Vector weights
- **Rich Results**: Displays FTS, vector, and fusion scores

## 🎯 Try These Examples

### Sample SQL Queries
```sql
-- View all documents
SELECT * FROM docs_default LIMIT 5;

-- Full-text search
SELECT * FROM fts_default WHERE fts_default MATCH 'machine learning';

-- Vector similarity search
SELECT id, title, vec_distance_cosine(embedding, vec_f32('[0.8,0.2,0.7,...]')) as distance
FROM vec_default_dense ORDER BY distance LIMIT 5;

-- Database statistics
SELECT COUNT(*) FROM docs_default;
```

### Sample Searches
- **Text**: "machine learning", "database systems", "web development"
- **Hybrid**: Use text + manual vector input for combined search
- **Fusion**: Try different fusion methods and weight combinations

## 🏗️ Architecture

### Components
```
examples/web-client/
├── index.html          # Main demo interface
├── demo.js            # Application logic & SDK integration
├── style.css          # Responsive styling
├── test-data.js       # Sample documents & vectors
└── README.md          # This file
```

### Dependencies
- **LocalRetrieve SDK** (`../../dist/localretrieve.mjs`)
- **SQLite WASM** with sqlite-vec extension
- **Web Workers** for non-blocking database operations
- **OPFS** for persistent storage

## 🔧 Technical Details

### Browser Requirements
- **SharedArrayBuffer**: Requires Cross-Origin-Isolation headers
- **OPFS**: Origin Private File System for persistence
- **ES Modules**: Modern JavaScript module support
- **Web Workers**: Background database operations

### Storage
- **OPFS Database**: `opfs:/localretrieve-demo/demo.db`
- **Automatic Persistence**: Data survives page reloads
- **Export Format**: Standard SQLite database files

### Performance
- **Cold Start**: < 300ms database initialization
- **Search Latency**: < 50ms for hybrid queries
- **Memory Usage**: Real-time monitoring in header
- **Background Sync**: Automatic OPFS synchronization

## 🐛 Troubleshooting

### Common Issues

**"Database initialization failed"**
- Ensure you're running a local server (not `file://`)
- Check browser console for COOP/COEP header warnings
- Verify SharedArrayBuffer availability: `typeof SharedArrayBuffer !== 'undefined'`

**"No results found" in search**
- Load sample data first using "Load Sample Data" button
- Verify documents exist: `SELECT COUNT(*) FROM docs_default;`
- Check FTS index: `SELECT * FROM fts_default LIMIT 1;`

**Import/Export not working**
- Current implementation returns placeholders
- Export functionality is partial (see CORE-005 in work breakdown)
- Use SQL operations for data inspection instead

**Slow performance**
- Check browser DevTools for memory usage
- Large datasets may require pagination
- Vector operations are computationally intensive

### Browser Compatibility

| Browser | Min Version | OPFS | SharedArrayBuffer | Status |
|---------|-------------|------|-------------------|---------|
| Chrome  | 86+         | ✅    | ✅                 | ✅ Full |
| Firefox | 79+         | ✅    | ✅                 | ✅ Full |
| Safari  | 15+         | ✅    | ✅                 | ✅ Full |
| Edge    | 86+         | ✅    | ✅                 | ✅ Full |

## 📊 Demo Data

### Sample Documents (8 total)
1. **Machine Learning Fundamentals** - AI/ML concepts
2. **Database Systems and SQL** - Database technologies
3. **Web Development with JavaScript** - Frontend development
4. **Artificial Intelligence and Neural Networks** - Deep learning
5. **Cloud Computing and Distributed Systems** - Cloud platforms
6. **Data Science and Analytics** - Data analysis
7. **Cybersecurity and Information Protection** - Security practices
8. **Software Engineering Best Practices** - Development methodologies

### Vector Dimensions
- **Size**: 384 dimensions (standard for many embedding models)
- **Format**: Float32Array with L2 normalization
- **Generation**: Mock vectors with realistic patterns for demo purposes

## 🔗 Related Files

- **Main SDK**: `../../src/index.ts`
- **Database Worker**: `../../src/database/worker.ts`
- **WASM Build**: `../../dist/sqlite3.wasm`
- **Type Definitions**: `../../src/types/`

## 📝 Development Notes

### Adding New Features
1. Update `demo.js` for new functionality
2. Add corresponding UI elements in `index.html`
3. Style new components in `style.css`
4. Test across target browsers

### Extending Test Data
1. Modify `test-data.js` to add documents
2. Ensure vectors are 384-dimensional
3. Update sample queries as needed
4. Regenerate mock vectors with `generateMockVector()`

---

**Built with LocalRetrieve MVP** - Hybrid search powered by SQLite + sqlite-vec