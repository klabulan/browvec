# Pattern: Worker RPC Communication

**Category:** Architecture
**Status:** Proven
**Related ADR:** [002-worker-isolation](../decisions/002-worker-isolation.md)

---

## Overview

LocalRetrieve uses a 3-tier architecture with Worker RPC to isolate heavy SQLite WASM operations from the main thread. All database operations are non-blocking from the UI perspective.

## Architecture

```
Main Thread              Worker Thread
┌─────────────┐         ┌──────────────┐
│  Database   │         │              │
│  (Proxy)    │◄────────┤ WASM Worker  │
└──────┬──────┘         │              │
       │                │ - SQLite     │
       │                │ - sqlite-vec │
┌──────▼──────┐         │ - FTS5       │
│  WorkerRPC  │◄───────►│              │
└─────────────┘         └──────────────┘
  postMessage()          onmessage()
```

## Implementation Pattern

### 1. RPC Abstraction Layer

**Location:** `src/utils/rpc.ts`

```typescript
class WorkerRPC {
    private worker: Worker;
    private pendingRequests: Map<string, PendingRequest>;
    private requestIdCounter: number;

    constructor(workerPath: string) {
        this.worker = new Worker(workerPath, { type: 'module' });
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;

        // Listen for responses
        this.worker.onmessage = (event) => this.handleResponse(event);
        this.worker.onerror = (error) => this.handleError(error);
    }

    async call<T>(method: string, params: any[]): Promise<T> {
        const requestId = `req_${this.requestIdCounter++}`;

        return new Promise((resolve, reject) => {
            // Store pending request
            this.pendingRequests.set(requestId, { resolve, reject });

            // Send to worker
            this.worker.postMessage({
                id: requestId,
                method,
                params
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`RPC timeout: ${method}`));
                }
            }, 30000);
        });
    }

    private handleResponse(event: MessageEvent) {
        const { id, result, error } = event.data;

        const pending = this.pendingRequests.get(id);
        if (!pending) return;

        this.pendingRequests.delete(id);

        if (error) {
            pending.reject(new Error(error.message));
        } else {
            pending.resolve(result);
        }
    }
}
```

### 2. Database Proxy (Main Thread)

**Location:** `src/database/Database.ts`

```typescript
export class Database {
    private rpc: WorkerRPC;

    constructor(dbPath: string) {
        this.rpc = new WorkerRPC('/database.worker.js');

        // Initialize database in worker
        await this.rpc.call('init', [dbPath]);
    }

    // SQL execution
    exec(sql: string): void {
        // Fire-and-forget (no return value)
        this.rpc.call('exec', [sql]);
    }

    // Query with results
    async prepare(sql: string): Promise<Statement> {
        const stmtId = await this.rpc.call<string>('prepare', [sql]);
        return new Statement(this.rpc, stmtId);
    }

    // Export database
    async export(): Promise<Uint8Array> {
        return await this.rpc.call<Uint8Array>('export', []);
    }
}
```

### 3. Worker Message Handler

**Location:** `src/database/worker/index.ts`

```typescript
// Worker-side message handler
let db: SQLiteDatabase | null = null;
const statements: Map<string, SQLiteStatement> = new Map();

self.onmessage = async (event: MessageEvent) => {
    const { id, method, params } = event.data;

    try {
        let result;

        switch (method) {
            case 'init':
                result = await initDatabase(params[0]);
                break;

            case 'exec':
                db!.exec(params[0]);
                result = null;
                break;

            case 'prepare':
                const stmt = db!.prepare(params[0]);
                const stmtId = `stmt_${Date.now()}`;
                statements.set(stmtId, stmt);
                result = stmtId;
                break;

            case 'step':
                const stmtId = params[0];
                const stmt = statements.get(stmtId)!;
                result = stmt.step();
                break;

            // ... other methods
        }

        // Send success response
        self.postMessage({ id, result });

    } catch (error: any) {
        // Send error response with context
        self.postMessage({
            id,
            error: {
                message: error.message,
                stack: error.stack,
                method,
                params
            }
        });
    }
};
```

## Error Propagation Pattern

**Critical:** Always propagate full error context from worker to main thread.

```typescript
// Worker-side error handling
catch (error: any) {
    self.postMessage({
        id,
        error: {
            message: error.message,
            stack: error.stack,
            method,  // Include method name
            params,  // Include parameters (sanitized if needed)
            sqlState: error.sqlState // SQLite-specific errors
        }
    });
}

// Main thread error handling
private handleResponse(event: MessageEvent) {
    const { id, result, error } = event.data;
    const pending = this.pendingRequests.get(id);

    if (error) {
        // Create rich error with context
        const err = new DatabaseError(
            `Worker RPC error in ${error.method}: ${error.message}`,
            {
                method: error.method,
                params: error.params,
                stack: error.stack,
                sqlState: error.sqlState
            }
        );
        pending.reject(err);
    }
}
```

## Transfer Optimization

**Use Transferable objects for large data:**

```typescript
// Export database (returns large Uint8Array)
async export(): Promise<Uint8Array> {
    const data = await this.rpc.call<Uint8Array>('export', []);
    return data; // Browser handles transfer automatically for TypedArrays
}

// Manual transfer (if needed)
worker.postMessage(
    { id, result: largeBuffer },
    [largeBuffer.buffer] // Transfer ownership
);
```

## Request Lifecycle

```
1. Main Thread: Database.exec(sql)
   ↓
2. RPC: Create request ID, store promise
   ↓
3. Worker: postMessage({ id, method: 'exec', params: [sql] })
   ↓
4. Worker Thread: Receive message
   ↓
5. Worker: Execute SQLite operation
   ↓
6. Worker: postMessage({ id, result }) or { id, error }
   ↓
7. Main Thread: Receive response
   ↓
8. RPC: Resolve/reject promise
   ↓
9. Main Thread: Promise completes
```

## Performance Characteristics

**Overhead:**
- Message serialization: ~0.1-1ms
- Worker communication: ~0.5-2ms
- Total RPC overhead: ~1-3ms per call

**Benefits:**
- Main thread never blocks
- UI remains responsive during heavy queries
- SQLite operations can use full CPU core

**Best Practices:**
- Batch operations when possible
- Use transactions for multiple writes
- Minimize number of RPC calls

## Common Pitfalls

### ❌ Synchronous API Expectations
```typescript
// WRONG - RPC is always async
const result = db.exec(sql);

// CORRECT - Use await
await db.exec(sql);
```

### ❌ Missing Error Context
```typescript
// WRONG - Generic error
throw new Error('Database error');

// CORRECT - Include context
throw new DatabaseError('Query failed', {
    sql,
    method: 'exec',
    originalError: error.message
});
```

### ❌ Memory Leaks in Statements
```typescript
// WRONG - Statement never cleaned up
const stmt = await db.prepare(sql);
stmt.step();
// ... stmt never finalized

// CORRECT - Always finalize
const stmt = await db.prepare(sql);
try {
    stmt.step();
} finally {
    stmt.finalize();
}
```

## Testing

**Unit tests:**
```typescript
describe('WorkerRPC', () => {
    it('should handle successful responses', async () => {
        const rpc = new WorkerRPC('/worker.js');
        const result = await rpc.call('echo', ['hello']);
        expect(result).toBe('hello');
    });

    it('should propagate errors with context', async () => {
        const rpc = new WorkerRPC('/worker.js');

        await expect(
            rpc.call('invalid_method', [])
        ).rejects.toThrow(/Unknown method: invalid_method/);
    });

    it('should timeout long-running operations', async () => {
        const rpc = new WorkerRPC('/worker.js');

        await expect(
            rpc.call('sleep', [60000]) // 60 second operation
        ).rejects.toThrow(/timeout/);
    }, 35000); // Test timeout > RPC timeout
});
```

## Related Patterns

- [OPFS Persistence](opfs-persistence.md) - OPFS operations via RPC
- [SQLite WASM](sqlite-wasm.md) - WASM runs in worker
- [Embedding Queue](embedding-queue.md) - Queue processing via RPC

## Security Considerations

**Worker isolation:**
- Worker runs in separate thread (security boundary)
- Cannot access DOM
- Cannot access window object
- Limited global scope

**Message validation:**
```typescript
// Validate incoming messages
self.onmessage = (event) => {
    const { id, method, params } = event.data;

    // Validate structure
    if (!id || typeof method !== 'string' || !Array.isArray(params)) {
        console.error('Invalid RPC message', event.data);
        return;
    }

    // Validate method whitelist
    const ALLOWED_METHODS = ['init', 'exec', 'prepare', ...];
    if (!ALLOWED_METHODS.includes(method)) {
        self.postMessage({
            id,
            error: { message: `Unknown method: ${method}` }
        });
        return;
    }

    // Process request
    handleRequest(id, method, params);
};
```

## References

- **Web Workers:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **Transferable Objects:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- **Structured Clone:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

## Last Updated

2025-10-16 - Initial documentation
