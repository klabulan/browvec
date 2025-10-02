# LocalRetrieve Distribution Fix - Task Overview

**Date**: 2025-10-02
**Status**: Ready for Implementation
**Priority**: HIGH - Blocks downstream integrations

---

## Problem Summary

**Issue**: Installing LocalRetrieve from GitHub (`npm install https://github.com/klabulan/browvec.git`) results in incomplete package missing critical WASM files.

**Root Cause**: WASM files are build artifacts excluded from git, so GitHub-based npm installs don't get them.

**Impact**:
- Downstream projects can't use npm install from GitHub
- Manual file copying required (error-prone)
- No verification that installation is complete
- Poor developer experience for integrators

---

## Documents in This Task

1. **`architecture.md`** - Deep analysis of current state
   - File distribution reality
   - Root cause analysis
   - Two-track solution (immediate + upstream)
   - Integration patterns for downstream projects

2. **`FIX_PLAN.md`** - Implementation roadmap (THIS REPO)
   - Phase 1: Include WASM in distribution (git or Git LFS)
   - Phase 2: Installation verification script
   - Phase 3: Deployment bundle tool
   - Phase 4: Documentation updates
   - Estimated effort: ~5 hours (1 day)

---

## Quick Start (For Implementation)

### ✅ Prerequisites
- WASM files already built and in `dist/` (verified ✓)
- Git repo is healthy
- Have write access to repo

### 🚀 Immediate Actions

**Step 1**: Commit WASM to git (recommended approach)
```bash
# Update .gitignore to allow WASM
# Edit: Remove or comment out: dist/**/*.wasm

# Add WASM files
git add -f dist/sqlite3.wasm
git commit -m "build: Include WASM binaries for GitHub npm installs"
git push
```

**Step 2**: Add verification script
```bash
# Create scripts/verify-install.js (see FIX_PLAN.md)
npm run verify  # Test it works
git add scripts/verify-install.js package.json
git commit -m "feat: Add installation verification script"
```

**Step 3**: Test GitHub install
```bash
# In a temp directory
mkdir /tmp/test-lr && cd /tmp/test-lr
npm init -y
npm install https://github.com/klabulan/browvec.git

# Should see verification pass:
# ✅ LocalRetrieve installation verified successfully!
```

**Step 4**: Add bundle tool (optional but recommended)
```bash
# Create scripts/create-bundle.js (see FIX_PLAN.md)
npm install --save-dev fs-extra
npm run bundle  # Test it works
```

---

## Decision Required

**Question**: How should we include WASM in distribution?

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **1A: Commit to git** | Simple, works immediately | +1.3MB repo size | ⭐ **RECOMMENDED** |
| **1B: Git LFS** | Small repo | Requires LFS setup | Alternative if size is concern |
| **1C: Releases only** | Clean repo | Extra workflow complexity | Not recommended |

**Recommendation**: **Option 1A** - Commit WASM to git
- Simplest for developers
- Industry standard (sql.js does this)
- 1.3MB is acceptable
- No additional tooling required

---

## Success Metrics

After implementation:
1. ✅ `npm install` from GitHub includes all files
2. ✅ Postinstall hook verifies installation
3. ✅ `npm run bundle` creates deployment package
4. ✅ Clear error messages when incomplete
5. ✅ Integrators don't need manual file copying

---

## Timeline

- **Phase 1** (WASM in git): 30 minutes
- **Phase 2** (Verification): 1 hour
- **Phase 3** (Bundle tool): 2 hours
- **Phase 4** (Docs): 1 hour
- **Testing**: 30 minutes

**Total**: ~5 hours (one development session)

---

## Next Steps

1. **Review**: Read `FIX_PLAN.md` for detailed implementation
2. **Decide**: Approve Option 1A (commit WASM to git)
3. **Implement**: Follow checklist in FIX_PLAN.md
4. **Test**: Verify GitHub npm install works
5. **Document**: Update README with new workflows

---

## References

- **Detailed Analysis**: `architecture.md`
- **Implementation Plan**: `FIX_PLAN.md`
- **Current Build**: `dist/sqlite3.wasm` exists (1.33 MB) ✓
- **Example Projects**: sql.js, wa-sqlite (both commit WASM)

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Owner**: TBD
**Review**: Please review `FIX_PLAN.md` and approve approach
