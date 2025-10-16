# Workflow State Tracker

**Purpose:** Track Edgar protocol compliance and workflow progression for each task

**Last Updated:** 2025-10-16

---

## Active Task Workflows

### Format
```yaml
task_id: YYYYMMDD_task_name
title: Short description
classification: small | medium | large
required_steps: [list of required modes]
completed_steps: [list of completed modes with timestamps]
current_step: [mode in progress or null]
status: registered | planning | designing | reviewing_arch | developing | reviewing_impl | complete | blocked
created: YYYY-MM-DD HH:MM
last_updated: YYYY-MM-DD HH:MM
```

---

## Currently Active

_No tasks currently in Edgar workflow_

---

## Recently Completed

### 20251016_fts5_enhanced_tokenizer
```yaml
task_id: 20251016_fts5_enhanced_tokenizer
title: Add unicode61 tokenizer for Cyrillic/multilingual search
classification: medium
required_steps: [PLAN, DEVELOP]
completed_steps:
  - Direct implementation (2025-10-16 14:30) - Pre-enforcement
status: complete
notes: Completed before protocol enforcement system activated
```

---

## Protocol Violations Log

_Track any attempts to bypass workflow for audit purposes_

### Format
```yaml
timestamp: YYYY-MM-DD HH:MM
task_id: YYYYMMDD_task_name
violation_type: [skipped_step | wrong_order | missing_prerequisite]
attempted_mode: [mode that was blocked]
missing_steps: [list of prerequisites not met]
action_taken: [blocked | allowed_with_warning | override_approved]
approver: [user | main_agent]
```

---

## How Edgar Uses This File

### At Start of Each Mode

**1. Read workflow_state.md**

**2. Check if task exists**
- If NO → Register new task (prompt for classification if unclear)
- If YES → Load current state

**3. Validate prerequisites**
- Check completed_steps contains all required prerequisites for current mode
- If prerequisites missing → BLOCK execution and return error
- If prerequisites met → Proceed

**4. Update state**
- Set current_step = [current mode]
- Set status = [appropriate status]
- Update last_updated timestamp

### At End of Mode

**1. Mark step complete**
- Add current mode to completed_steps with timestamp
- Set current_step = null
- Update status

**2. Determine next required step**
- Based on classification and required_steps
- Inform main agent what to invoke next

**3. Check if workflow complete**
- If all required_steps in completed_steps → status = complete
- Archive to "Recently Completed" section

---

## Classification Rules

### Small (<2 hours, low risk)
**Required Steps:** [] (no Edgar tracking)
**Examples:** Typos, formatting, obvious fixes
**Protocol:** Main agent acts directly, no workflow_state entry needed

### Medium (2-8 hours, medium risk)
**Required Steps:** [PLAN, DEVELOP]
**Examples:** Features, optimizations, refactoring
**Protocol:** PLAN → DEVELOP (ROAST optional)

### Large (>8 hours, high risk)
**Required Steps:** [PLAN, ARCHITECT, ROAST_ARCH, DEVELOP, ROAST_IMPL]
**Examples:** Major features, architectural changes, breaking changes
**Protocol:** PLAN → ARCHITECT → ROAST → DEVELOP → ROAST (all mandatory)

---

## Enforcement Level

**Current:** STRICT
- Edgar BLOCKS execution if prerequisites missing
- NO manual overrides allowed
- Main agent must fix workflow and re-invoke

**Future Options:**
- WARNING_ONLY: Edgar warns but allows (not recommended)
- USER_OVERRIDE: Edgar blocks but user can approve bypass (for emergencies)

---

## Notes

- This file is updated AUTOMATICALLY by Edgar agent
- DO NOT manually edit completed_steps (corruption risk)
- If workflow stuck, discuss with user to resolve (don't hack state file)
- Archive completed tasks monthly to keep file size manageable

---

**Maintained by:** Edgar Agent
**Protocol Version:** 1.0.0
**Status:** Active
