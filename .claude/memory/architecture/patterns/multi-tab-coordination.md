# Pattern: Multi-Tab Coordination

**Category:** Browser APIs
**Status:** Proven

---

## Overview

LocalRetrieve coordinates multiple browser tabs accessing the same OPFS database using Web Locks API for primary tab election and BroadcastChannel for inter-tab communication.

## Primary/Secondary Pattern

**Primary tab:** Holds exclusive write lock, manages OPFS sync
**Secondary tabs:** Read-only access, listen for updates

## Web Locks API

```typescript
async function requestPrimaryLock(dbPath: string): Promise<boolean> {
    try {
        await navigator.locks.request(
            `localretrieve-${dbPath}`,
            { mode: 'exclusive', ifAvailable: true },
            async (lock) => {
                if (!lock) {
                    // Lock not available, become secondary
                    return false;
                }

                // We are primary tab
                console.log('Acquired primary lock');

                // Hold lock until tab closes
                await new Promise(() => {}); // Never resolves
            }
        );
        return true;
    } catch (error) {
        console.warn('Lock acquisition failed', error);
        return false;
    }
}
```

## BroadcastChannel for Updates

```typescript
const channel = new BroadcastChannel(`localretrieve-${dbPath}`);

// Primary tab: Broadcast changes
function notifyChange(change: DatabaseChange) {
    channel.postMessage({
        type: 'database-updated',
        change
    });
}

// Secondary tabs: Listen for changes
channel.onmessage = (event) => {
    if (event.data.type === 'database-updated') {
        // Refresh local state
        reloadDatabase();
    }
};
```

## Related Patterns

- [OPFS Persistence](opfs-persistence.md) - Shared via OPFS
- [Worker RPC](worker-rpc.md) - Each tab has own worker

## Last Updated

2025-10-16
