# Pattern: OPFS Persistence

**Category:** Browser Storage
**Status:** Proven
**Related ADR:** [001-opfs-persistence](../decisions/001-opfs-persistence.md)

---

## Overview

LocalRetrieve uses Origin Private File System (OPFS) for browser-native database persistence. This pattern enables SQLite databases to persist across page reloads while remaining fully client-side.

## Key Concepts

**OPFS (Origin Private File System):**
- Browser-native file system API
- Private to origin (not user-accessible)
- Supports efficient file I/O operations
- Available in modern browsers (Chrome 86+, Firefox 111+, Safari 15.2+)

**Path Convention:**
```
opfs:/[namespace]/[database-name].db

Examples:
- opfs:/localretrieve-demo/demo.db
- opfs:/my-app/knowledge-base.db
```

## Implementation Pattern

### 1. Path Detection

```typescript
function isOPFSPath(path: string): boolean {
    return path.startsWith('opfs:/');
}
```

### 2. Database Initialization

**Location:** `src/database/worker/core/opfs.ts` (inferred pattern)

```typescript
async function initDatabaseWithOPFS(path: string) {
    if (isOPFSPath(path)) {
        // 1. Create in-memory database first
        const db = createInMemoryDatabase();

        // 2. Try to load from OPFS if exists
        try {
            const data = await readFromOPFS(path);
            if (data) {
                db.loadFromBuffer(data);
            }
        } catch (error) {
            // OPFS not available or file doesn't exist
            console.warn('OPFS load failed, using memory-only', error);
        }

        // 3. Set up auto-sync
        setupOPFSSync(db, path);

        return db;
    } else {
        // Regular in-memory database
        return createInMemoryDatabase();
    }
}
```

### 3. Sync Mechanisms

**Auto-save on changes:**
```typescript
function setupOPFSSync(db, path: string) {
    // Debounced save to avoid excessive writes
    const debouncedSave = debounce(async () => {
        try {
            const data = db.export();
            await writeToOPFS(path, data);
        } catch (error) {
            console.error('OPFS sync failed:', error);
        }
    }, 1000); // 1 second debounce

    // Trigger on database changes
    db.on('change', debouncedSave);
}
```

### 4. OPFS Access Layer

```typescript
async function readFromOPFS(path: string): Promise<Uint8Array | null> {
    const opfsPath = parseOPFSPath(path); // opfs:/namespace/file.db

    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(opfsPath.namespace, { create: true });

    try {
        const fileHandle = await dir.getFileHandle(opfsPath.filename);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (error) {
        // File doesn't exist yet
        return null;
    }
}

async function writeToOPFS(path: string, data: Uint8Array): Promise<void> {
    const opfsPath = parseOPFSPath(path);

    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(opfsPath.namespace, { create: true });
    const fileHandle = await dir.getFileHandle(opfsPath.filename, { create: true });

    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
}
```

## Fallback Strategy

**OPFS may not be available:**
- Browser doesn't support it
- Insufficient storage quota
- Private browsing mode
- Filesystem permissions denied

**Graceful degradation:**
```typescript
try {
    await initWithOPFS(path);
    console.log('OPFS persistence enabled');
} catch (error) {
    console.warn('OPFS unavailable, using memory-only mode', error);
    // Continue with in-memory database
    // Data won't persist across reloads
}
```

## Browser Compatibility

**Required APIs:**
- `navigator.storage.getDirectory()` (OPFS root)
- `FileSystemDirectoryHandle`
- `FileSystemFileHandle`
- `FileSystemWritableFileStream`

**Support matrix:**
- ✅ Chrome 86+ (stable)
- ✅ Edge 86+ (stable)
- ✅ Firefox 111+ (stable)
- ✅ Safari 15.2+ (stable)

## Performance Characteristics

**Read operations:**
- First load: ~50-200ms (file I/O)
- Subsequent: Cached in memory

**Write operations:**
- Debounced (1 second)
- Async (non-blocking)
- ~10-50ms per save

**Storage limits:**
- Quota-based (browser-managed)
- Typically gigabytes available
- Check quota: `navigator.storage.estimate()`

## Common Pitfalls

### ❌ Incorrect Path Format
```typescript
// WRONG
const db = await initLocalRetrieve('localretrieve-demo/demo.db');

// CORRECT
const db = await initLocalRetrieve('opfs:/localretrieve-demo/demo.db');
```

### ❌ Synchronous OPFS Access
```typescript
// WRONG - OPFS is always async
const data = readFromOPFSSync(path);

// CORRECT - Use async/await
const data = await readFromOPFS(path);
```

### ❌ No Error Handling
```typescript
// WRONG - Assumes OPFS always works
await writeToOPFS(path, data);

// CORRECT - Handle failures gracefully
try {
    await writeToOPFS(path, data);
} catch (error) {
    console.warn('Persistence failed, continuing in-memory', error);
}
```

## Testing

**Unit tests:**
```typescript
describe('OPFS Persistence', () => {
    it('should detect OPFS paths', () => {
        expect(isOPFSPath('opfs:/demo/db.db')).toBe(true);
        expect(isOPFSPath(':memory:')).toBe(false);
    });

    it('should fallback gracefully when OPFS unavailable', async () => {
        // Mock OPFS unavailable
        vi.spyOn(navigator.storage, 'getDirectory').mockRejectedValue(new Error('Not supported'));

        const db = await initLocalRetrieve('opfs:/test/db.db');

        // Should still create database (in-memory)
        expect(db).toBeDefined();
    });
});
```

**E2E tests:** See `tests/e2e/persistence.spec.ts`

## Related Patterns

- [Worker RPC](worker-rpc.md) - OPFS operations happen in worker
- [Multi-Tab Coordination](multi-tab-coordination.md) - OPFS shared across tabs
- [Schema Management](schema-management.md) - Schema persisted via OPFS

## References

- **Spec:** https://fs.spec.whatwg.org/
- **MDN:** https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- **Caniuse:** https://caniuse.com/native-filesystem-api

## Last Updated

2025-10-16 - Initial documentation
