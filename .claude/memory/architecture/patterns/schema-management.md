# Pattern: Schema Auto-Initialization

**Category:** Database Management
**Status:** Proven
**Related ADR:** [005-schema-auto-initialization](../decisions/005-schema-auto-initialization.md)

---

## Overview

LocalRetrieve auto-initializes database schema on first use and performs consistency checks on subsequent loads. If partial schema detected, drops and recreates for consistency.

## Required Tables

```sql
-- 1. Document storage
CREATE TABLE IF NOT EXISTS docs_default (...);

-- 2. FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(...);

-- 3. Vector search
CREATE VIRTUAL TABLE IF NOT EXISTS vec_default_dense USING vec0(...);

-- 4. Collections metadata
CREATE TABLE IF NOT EXISTS collections (...);

-- 5. Embedding queue (Phase 5)
CREATE TABLE IF NOT EXISTS embedding_queue (...);
```

## Initialization Logic

```typescript
async function initializeSchema(db: Database): Promise<void> {
    // Check which tables exist
    const tables = await db.all(`
        SELECT name FROM sqlite_master
        WHERE type='table'
    `);

    const hasAllTables = REQUIRED_TABLES.every(t =>
        tables.some(existing => existing.name === t)
    );

    if (!hasAllTables && tables.length > 0) {
        // Partial schema - drop and recreate for consistency
        console.warn('Partial schema detected, recreating');
        await dropAllTables(db);
    }

    // Create schema (idempotent with IF NOT EXISTS)
    await db.exec(SCHEMA_SQL);
}
```

## Critical: FTS5 Sync

**Recent fix (2025-10-16):** Triggers replaced with manual sync to prevent memory exhaustion.

**Manual sync pattern:**
```typescript
// After inserting into docs_default
await db.run(`INSERT INTO docs_default (...) VALUES (...)`);

// Manually sync to FTS5
await db.run(`INSERT INTO fts_default(rowid, content) VALUES (?, ?)`, [docId, content]);
```

## Related Patterns

- [SQLite WASM](sqlite-wasm.md) - Creates schema
- [OPFS Persistence](opfs-persistence.md) - Schema persisted

## Last Updated

2025-10-16
