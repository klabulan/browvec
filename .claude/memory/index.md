# Memory Bank Index

**Purpose:** Persistent knowledge repository for LocalRetrieve project. Edgar agent MUST consult memory bank before making decisions.

**Last Updated:** 2025-10-16

---

## Quick Navigation

### 📐 Architecture
- **[Decisions](architecture/decisions/)** - ADRs (Architecture Decision Records)
- **[Patterns](architecture/patterns/)** - Proven implementation patterns
- **[Diagrams](architecture/diagrams/)** - System context and component diagrams

### 📊 Context
- **[project_state.md](context/project_state.md)** - Current project status
- **[active_work.md](context/active_work.md)** - In-progress tasks
- **[known_issues.md](context/known_issues.md)** - Technical debt and limitations

### 🎓 Lessons
- **[what_works.md](lessons/what_works.md)** - Successful approaches
- **[what_doesnt.md](lessons/what_doesnt.md)** - Anti-patterns to avoid
- **[gotchas.md](lessons/gotchas.md)** - Common pitfalls and surprises

---

## How to Use Memory Bank

### For Edgar Agent

**BEFORE any task:**
```markdown
1. Read memory bank index
2. Check architecture/patterns/ for established solutions
3. Check architecture/decisions/ for past ADRs
4. Check lessons/gotchas.md for known pitfalls
5. Check context/project_state.md for current status
```

**DURING task execution:**
```markdown
1. Document decisions immediately (not at end)
2. Use ADR template for architectural choices
3. Update context/active_work.md with progress
4. Note surprises in lessons/ files
```

**AFTER task completion:**
```markdown
1. Update project_state.md with new capabilities
2. Capture lessons learned in lessons/ files
3. Document new patterns in architecture/patterns/
4. Archive completed work from active_work.md
```

### For Main Agent (CLAUDE.md)

When invoking Edgar agent, include memory bank context:
```markdown
Task tool → edgar agent
prompt: |
  [MODE] mode

  Request: [description]

  MANDATORY: Check memory bank first
  - Read: .claude/memory/architecture/patterns/[relevant].md
  - Read: .claude/memory/lessons/gotchas.md
  - Reference related ADRs if making architectural decisions
```

---

## Core LocalRetrieve Patterns

**Quick reference to documented patterns:**

1. **OPFS Persistence** → `architecture/patterns/opfs-persistence.md`
   - Browser-native file system storage
   - Path format: `opfs:/namespace/database.db`
   - Sync mechanisms and fallback strategies

2. **Worker RPC Communication** → `architecture/patterns/worker-rpc.md`
   - 3-tier architecture: API → RPC → WASM Worker
   - Message passing protocol
   - Error propagation and handling

3. **SQLite WASM Integration** → `architecture/patterns/sqlite-wasm.md`
   - Emscripten compilation
   - Dynamic loading in worker
   - sqlite-vec extension integration

4. **Hybrid Search** → `architecture/patterns/hybrid-search.md`
   - BM25 full-text search (FTS5)
   - Vector similarity search (sqlite-vec)
   - Result merging strategies

5. **Embedding Queue** → `architecture/patterns/embedding-queue.md`
   - Background processing architecture
   - Priority-based scheduling
   - Retry mechanisms with exponential backoff

6. **Multi-Tab Coordination** → `architecture/patterns/multi-tab-coordination.md`
   - Web Locks API for primary election
   - BroadcastChannel for cross-tab communication
   - State synchronization patterns

7. **Schema Management** → `architecture/patterns/schema-management.md`
   - Auto-initialization on missing tables
   - Consistency checks and recovery
   - Migration strategies

8. **Testing Strategy** → `architecture/patterns/testing-strategy.md`
   - Pragmatic testing approach
   - Playwright E2E integration tests
   - Unit test patterns for business logic

---

## Architecture Decision Records (ADRs)

**Format:** `architecture/decisions/NNN-title.md`

**Current ADRs:**
- [001-opfs-persistence](architecture/decisions/001-opfs-persistence.md)
- [002-worker-isolation](architecture/decisions/002-worker-isolation.md)
- [003-sqlite-vec-integration](architecture/decisions/003-sqlite-vec-integration.md)
- [004-embedding-queue-architecture](architecture/decisions/004-embedding-queue-architecture.md)
- [005-schema-auto-initialization](architecture/decisions/005-schema-auto-initialization.md)

**ADR Template:** See `architecture/decisions/TEMPLATE.md`

---

## Project Context

**Current Phase:** Phase 5 (Embedding Queue System) - Completed
**Active Work:** Orchestrator agent system implementation
**Last Major Change:** FTS5 trigger optimization (2025-10-16)

See `context/project_state.md` for detailed status.

---

## Common Pitfalls (Quick Reference)

1. **OPFS path format:** Must start with `opfs:/` - check `lessons/gotchas.md`
2. **Worker RPC errors:** Always propagate context - see `patterns/worker-rpc.md`
3. **SQLite initialization:** Don't double-init - see `lessons/what_doesnt.md`
4. **Vector dimensions:** Must be 384-dim Float32Array - see `patterns/hybrid-search.md`
5. **COOP/COEP headers:** Required for SharedArrayBuffer - see `gotchas.md`

---

## Memory Bank Maintenance

**Regular tasks:**
- **Weekly:** Review and archive completed work from active_work.md
- **Monthly:** Update project_state.md with milestone progress
- **After major features:** Add lessons learned, update patterns
- **Before releases:** Review known_issues.md, document mitigations

**Archival policy:**
- Keep last 3 months of active work
- Archive older work to `tasks/` directory
- Preserve all ADRs (never delete)
- Keep patterns current (update when improved)

---

## Questions?

If Edgar agent encounters unclear situations:
1. Check this index for navigation
2. Search memory bank for keywords
3. If no guidance found, document the decision as new ADR
4. Update memory bank with the new knowledge

**Memory bank grows with project - keep it current!**
