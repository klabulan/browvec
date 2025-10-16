# Pattern: Workflow Enforcement

**Pattern Name:** Edgar Protocol Enforcement
**Category:** Process
**Status:** Active
**Last Updated:** 2025-10-16

---

## Context

Edgar agent operates in 4 modes (PLAN, ARCHITECT, DEVELOP, ROAST) with a documented workflow, but there was no automatic enforcement ensuring the protocol is followed for each task classification.

---

## Problem

**Without enforcement:**
1. Main agent can skip PLAN and go directly to implementation
2. Large tasks can bypass ARCHITECT or ROAST modes
3. No tracking of which protocol steps have been completed
4. Workflow state is lost between mode invocations
5. Easy to forget required steps under time pressure

**Result:** Inconsistent quality, architectural debt, missed opportunities for review.

---

## Solution: 3-Layer Enforcement

### Layer 1: Workflow State File

**File:** `.claude/memory/context/active_work.md`

**Purpose:** Persistent state tracking across mode invocations

**Structure:**
```yaml
task_id: YYYYMMDD_task_name
classification: small | medium | large
required_steps: [modes that must be completed]
completed_steps: [modes already done]
current_step: [mode currently executing]
status: planning | designing | developing | reviewing | complete
```

**Behavior:**
- Edgar reads this file at start of each mode
- Edgar validates previous steps completed
- Edgar updates file before returning
- Edgar BLOCKS execution if required steps missing

---

### Layer 2: Edgar Mode Validation

**In edgar.md - Add to ALL mode procedures:**

```markdown
### STEP 0: Validate Workflow State (MANDATORY)

Read: .claude/memory/context/active_work.md

Check:
1. Is this task registered?
   - If NO → Register it now with classification
2. Are prerequisite steps completed?
   - PLAN mode: No prerequisites
   - ARCHITECT mode: Requires PLAN complete
   - DEVELOP mode: Requires PLAN (medium) OR PLAN+ARCHITECT+ROAST (large)
   - ROAST mode: Requires PLAN+ARCHITECT (for arch review) OR PLAN+DEVELOP (for impl review)
3. Is current step appropriate?
   - If NO → BLOCK and return error

Update active_work.md:
- Mark current_step as in_progress
- Log timestamp

Proceed only if validation passes.
```

**Enforcement Rules:**

| Task Class | Required Sequence | Can Skip? |
|------------|------------------|-----------|
| Small (<2h) | Direct implementation | All Edgar modes (document in git) |
| Medium (2-8h) | PLAN → DEVELOP | ARCHITECT, ROAST (optional but recommended) |
| Large (>8h) | PLAN → ARCHITECT → ROAST(arch) → DEVELOP → ROAST(impl) | **NOTHING** (all mandatory) |

---

### Layer 3: Main Agent Invocation Protocol

**In CLAUDE.md - Update decision tree to:**

```markdown
## MANDATORY Protocol Enforcement

### Small Changes (<2 hours, low risk)
**Examples:** Typos, formatting, minor fixes

**Protocol:**
✅ Main agent acts directly (no Edgar)
✅ Document in git commit
❌ NO workflow tracking needed

---

### Medium Changes (2-8 hours, medium risk)
**Examples:** New features, optimizations, refactoring

**Protocol (MANDATORY):**
1. ✅ Main agent → Edgar PLAN mode
   - Edgar registers task in active_work.md
   - Edgar returns execution plan
2. ✅ Main agent → Edgar DEVELOP mode
   - Edgar validates PLAN completed
   - Edgar implements following 8 steps
   - Edgar updates active_work.md
3. ⚠️ OPTIONAL: Main agent → Edgar ROAST mode
   - Edgar validates DEVELOP completed
   - Edgar performs quality review

**Enforcement:**
- Edgar WILL BLOCK DEVELOP if PLAN not completed
- Main agent MUST invoke PLAN first

---

### Large Changes (>8 hours, high risk)
**Examples:** New architectures, major refactoring, breaking changes

**Protocol (ABSOLUTELY MANDATORY - NO EXCEPTIONS):**
1. ✅ Main agent → Edgar PLAN mode
   - Edgar registers task, classifies as LARGE
   - Edgar creates execution plan

2. ✅ Main agent → Edgar ARCHITECT mode
   - Edgar validates PLAN completed (BLOCKS if not)
   - Edgar designs architecture + ADR

3. ✅ Main agent → Edgar ROAST mode (architecture)
   - Edgar validates ARCHITECT completed (BLOCKS if not)
   - Edgar performs brutal review
   - Edgar returns: APPROVE | REVISE | REJECT

4. 🔄 IF REVISE: Loop steps 2-3 until APPROVED

5. ✅ Main agent → Edgar DEVELOP mode
   - Edgar validates: PLAN + ARCHITECT + ROAST(APPROVED)
   - Edgar BLOCKS if any missing
   - Edgar implements following 8 steps

6. ✅ Main agent → Edgar ROAST mode (implementation)
   - Edgar validates DEVELOP completed
   - Edgar performs final quality check
   - Edgar returns: APPROVE | REVISE

7. 🔄 IF REVISE: Fix issues, re-invoke ROAST

**Enforcement:**
- Edgar WILL REFUSE to proceed if any step skipped
- Main agent CANNOT bypass (hard block)
- ALL steps required, NO shortcuts
```

---

## Implementation Details

### Edgar Mode: Validation Logic

**Add to beginning of EVERY mode in edgar.md:**

```markdown
## STEP 0: WORKFLOW VALIDATION (MANDATORY - CANNOT SKIP)

### Read Current Workflow State
Read: .claude/memory/context/active_work.md

### Extract or Register Task
If task not found in active_work.md:
  - Prompt main agent for task_id and classification
  - Register in active_work.md with initial state
  - Set required_steps based on classification:
    * Small: [] (no Edgar tracking)
    * Medium: [PLAN, DEVELOP]
    * Large: [PLAN, ARCHITECT, ROAST_ARCH, DEVELOP, ROAST_IMPL]

### Validate Prerequisites
Current Mode: [PLAN | ARCHITECT | DEVELOP | ROAST]

Required Prerequisites:
- PLAN: None
- ARCHITECT: [PLAN] must be in completed_steps
- DEVELOP:
  * Medium: [PLAN] must be completed
  * Large: [PLAN, ARCHITECT, ROAST_ARCH with APPROVE] must be completed
- ROAST:
  * Architecture review: [PLAN, ARCHITECT] must be completed
  * Implementation review: [PLAN, DEVELOP] must be completed (+ ARCHITECT if large)

If prerequisites NOT met:
  ❌ BLOCK EXECUTION
  Return error:
  ```
  WORKFLOW VIOLATION DETECTED

  Task: [task_id]
  Current Mode: [mode]
  Required Prerequisites: [list]
  Completed Steps: [list]
  Missing: [list]

  CANNOT PROCEED. Main agent must complete prerequisite steps first.

  Required sequence for [classification] tasks:
  [show required sequence]

  Edgar is now TERMINATING. Fix workflow and re-invoke.
  ```

### Update Workflow State
If validation passes:
  Edit: .claude/memory/context/active_work.md
  Update:
    current_step: [current mode]
    status: [appropriate status]
    last_updated: [timestamp]

### Proceed
Continue with normal mode execution...
```

---

## Benefits

### Quality Assurance
- ✅ All large changes get architecture review
- ✅ All large changes get critical review (ROAST)
- ✅ No skipping of important steps under pressure
- ✅ Consistent quality across all tasks

### Audit Trail
- ✅ Complete record of which steps completed
- ✅ Timestamps for each workflow transition
- ✅ Easy to see if protocol was followed
- ✅ Supports compliance and retrospectives

### Forcing Function
- ✅ Makes "right way" the only way for large tasks
- ✅ Prevents shortcuts that create technical debt
- ✅ Ensures documentation is created
- ✅ Builds institutional knowledge

---

## Trade-offs

### Pros
- **Consistency:** Every large task follows same rigorous process
- **Quality:** Multiple review checkpoints catch issues early
- **Documentation:** Forces creation of architecture docs
- **Learning:** Captured in memory bank automatically

### Cons
- **Overhead:** More steps = more time for large tasks
- **Rigidity:** Cannot skip steps even when "obviously not needed"
- **Friction:** Adds process to simple changes if misclassified

### Mitigation
- Classification matters: Be honest about small vs medium vs large
- Small tasks bypass entirely (no overhead)
- Medium tasks get lightweight protocol (PLAN → DEVELOP)
- Only large, high-risk changes get full protocol

---

## Usage Example

### Scenario: User requests multilingual search

**Main Agent Analysis:**
```markdown
Request: "Add support for 50+ languages in semantic search"

Classification: LARGE
- Estimated: 12-16 hours
- Risk: High (affects core search architecture)
- Impact: Breaking change to embedding system

Required Protocol: PLAN → ARCHITECT → ROAST → DEVELOP → ROAST
```

**Step 1: PLAN Mode**
```markdown
Main Agent → Edgar PLAN mode

Edgar:
  1. Reads active_work.md → Task not found
  2. Registers task: 20251016_multilang_search
  3. Sets classification: LARGE
  4. Sets required_steps: [PLAN, ARCHITECT, ROAST_ARCH, DEVELOP, ROAST_IMPL]
  5. Creates execution plan
  6. Updates active_work.md:
     - completed_steps: [PLAN]
     - current_step: complete
     - next_required: ARCHITECT
  7. Returns plan to main agent

Result: tasks/20251016_multilang_search/plan.md
```

**Step 2: ARCHITECT Mode**
```markdown
Main Agent → Edgar ARCHITECT mode

Edgar:
  1. Reads active_work.md → Task found
  2. Validates prerequisites:
     - Required: [PLAN]
     - Completed: [PLAN] ✅
  3. Proceeds with architecture design
  4. Creates architecture.md + ADR
  5. Updates active_work.md:
     - completed_steps: [PLAN, ARCHITECT]
     - current_step: complete
     - next_required: ROAST_ARCH
  6. Returns architecture

Result: tasks/20251016_multilang_search/architecture.md
```

**Step 3: ROAST Mode (Architecture)**
```markdown
Main Agent → Edgar ROAST mode

Edgar:
  1. Reads active_work.md → Task found
  2. Validates prerequisites:
     - Required: [PLAN, ARCHITECT]
     - Completed: [PLAN, ARCHITECT] ✅
  3. Performs brutal review
  4. Verdict: REVISE (found 2 critical issues)
  5. Updates active_work.md:
     - completed_steps: [PLAN, ARCHITECT, ROAST_ARCH_REVISE]
     - current_step: awaiting_revision
     - next_required: ARCHITECT (fix and re-submit)
  6. Returns review

Result: tasks/20251016_multilang_search/roast-arch-review.md
```

**Step 4: ARCHITECT Mode (Revision)**
```markdown
Main Agent fixes critical issues → Edgar ARCHITECT mode

Edgar:
  1. Detects task in revision state
  2. Validates prerequisites still met
  3. Updates architecture
  4. Updates active_work.md:
     - completed_steps: [PLAN, ARCHITECT_V2]
     - next_required: ROAST_ARCH (re-review)
  5. Returns updated architecture
```

**Step 5: ROAST Mode (Re-review)**
```markdown
Main Agent → Edgar ROAST mode

Edgar:
  1. Reviews updated architecture
  2. Verdict: APPROVE
  3. Updates active_work.md:
     - completed_steps: [PLAN, ARCHITECT, ROAST_ARCH_APPROVE]
     - next_required: DEVELOP
  4. Returns approval
```

**Step 6: DEVELOP Mode**
```markdown
Main Agent → Edgar DEVELOP mode

Edgar:
  1. Reads active_work.md
  2. Validates prerequisites:
     - Required: [PLAN, ARCHITECT, ROAST_ARCH with APPROVE]
     - Completed: [PLAN, ARCHITECT, ROAST_ARCH_APPROVE] ✅
  3. Implements following 8-step methodology
  4. Updates active_work.md:
     - completed_steps: [..., DEVELOP]
     - next_required: ROAST_IMPL
  5. Returns implementation

Result: Working code + tests + implementation.md
```

**Step 7: ROAST Mode (Implementation)**
```markdown
Main Agent → Edgar ROAST mode

Edgar:
  1. Validates DEVELOP completed
  2. Reviews implementation
  3. Verdict: APPROVE
  4. Updates active_work.md:
     - completed_steps: [..., ROAST_IMPL_APPROVE]
     - status: complete
  5. Archives task to completed section
  6. Returns approval

Result: Task complete, workflow verified ✅
```

### What Happens if Main Agent Tries to Skip?

**Scenario: Main agent tries to invoke DEVELOP without PLAN**

```markdown
Main Agent → Edgar DEVELOP mode (trying to skip PLAN)

Edgar STEP 0 Validation:
  1. Reads active_work.md → Task not found OR no PLAN in completed_steps
  2. BLOCKS EXECUTION
  3. Returns error:

❌ WORKFLOW VIOLATION - CANNOT PROCEED

Task: 20251016_multilang_search
Current Mode: DEVELOP
Classification: LARGE

Required Prerequisites: [PLAN, ARCHITECT, ROAST_ARCH with APPROVE]
Completed Steps: [] or [PLAN only]
Missing: ARCHITECT, ROAST_ARCH

DEVELOP mode CANNOT execute until all prerequisites completed.

Required sequence for LARGE tasks:
  1. PLAN mode
  2. ARCHITECT mode
  3. ROAST mode (architecture review) → Must return APPROVE
  4. DEVELOP mode ← YOU ARE HERE (BLOCKED)
  5. ROAST mode (implementation review)

Edgar is now TERMINATING.
Main agent must complete missing steps and re-invoke.

Edgar TERMINATES without executing DEVELOP.
```

**Main agent MUST fix workflow, cannot bypass.**

---

## Anti-Patterns to Avoid

### ❌ Don't Misclassify to Skip Protocol

**Wrong:**
```markdown
User: "Completely rewrite the embedding system for 50 languages"
Main Agent: "This is a medium task" (to avoid ARCHITECT/ROAST)
Edgar: Proceeds with lightweight protocol
Result: No architecture review, poor design, technical debt
```

**Right:**
```markdown
User: "Completely rewrite the embedding system for 50 languages"
Main Agent: "This is a LARGE task - high risk, architectural change"
Edgar: Enforces PLAN → ARCHITECT → ROAST → DEVELOP → ROAST
Result: Solid architecture, reviewed design, quality implementation
```

### ❌ Don't Skip ROAST "Just This Once"

**Wrong:**
```markdown
Main Agent: "ROAST takes time, let's skip for this large task"
Edgar DEVELOP: Would validate and BLOCK (prerequisites missing)
```

**Right:**
```markdown
Main Agent: "This is large, we need ROAST even under time pressure"
Edgar: Enforces full protocol
Result: Quality protected, issues caught early
```

### ❌ Don't Update active_work.md Manually to Bypass

**Wrong:**
```markdown
Main Agent: *Edits active_work.md to mark ARCHITECT complete*
Main Agent → Edgar DEVELOP mode
Result: Skipped critical architecture step
```

**Right:**
```markdown
Only Edgar should update active_work.md during mode execution
If you need to fix state, discuss with user first
```

---

## Maintenance

**Weekly:**
- Review active_work.md for stalled tasks
- Archive completed tasks

**Monthly:**
- Analyze protocol compliance rate
- Identify patterns of misclassification
- Update classification guidelines if needed

**After Issues:**
- If bug traced to skipped protocol, document in lessons/what_doesnt.md
- Tighten validation if bypasses discovered

---

## Related Patterns

- **Root Cause Analysis** (PERSONA.md) - Why we need PLAN mode
- **8-Step Methodology** (PERSONA.md) - What DEVELOP mode enforces
- **Memory Bank Integration** (index.md) - Where workflow state lives
- **ADR Creation** (architecture/decisions/) - Output of ARCHITECT mode

---

## Status

**Active:** Enforcement now mandatory for all tasks
**Next Review:** After 10 large tasks completed under new protocol
**Success Metrics:**
- 100% protocol compliance for large tasks
- 0 skipped steps without documented exception
- Improved architecture quality (measured by post-release bugs)

---

**Pattern Owner:** Edgar Agent
**Last Updated:** 2025-10-16
