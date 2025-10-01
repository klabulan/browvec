# Critical Updates Required

This document lists critical issues that must be addressed before the library can be successfully installed from GitHub.

## 🔴 CRITICAL: Build Output Not Committed to Git

**Priority**: HIGHEST
**Impact**: Installation from GitHub will fail
**Status**: BLOCKING

### Problem

The `.gitignore` file currently excludes the `dist/` directory:

```gitignore
# Line 6-8 in .gitignore
.build/
dist/
build/
```

This means the prebuilt files are not committed to GitHub, making direct GitHub installation impossible.

### Why This Matters

When users run:
```bash
npm install github:your-org/localretrieve
```

npm expects the built files to be in the repository. Without them, installation will fail with:
```
Error: Cannot find module 'localretrieve'
```

### Solution Options

**Option 1: Commit dist/ to Repository (Recommended for User Convenience)**

1. Remove `dist/` from `.gitignore`
2. Build the project: `npm run build`
3. Commit dist/ files:
   ```bash
   git rm -r --cached dist/
   git add dist/
   git commit -m "chore: add prebuilt dist files for GitHub installation"
   ```

**Pros:**
- Users can install directly from GitHub
- No build step required for end users
- Works with GitHub CDN services

**Cons:**
- Larger repository size
- Build artifacts in version control

**Option 2: Use npm Registry Only**

Keep `.gitignore` as-is and only distribute via npm.

**Pros:**
- Cleaner repository
- Standard npm workflow

**Cons:**
- Must publish to npm first
- No direct GitHub installation
- Requires npm account and publishing setup

### Recommended Action

**For production use: Option 1** - Commit `dist/` folder

This is the standard practice for libraries that want to support GitHub installation. Examples:
- Many UI component libraries
- Browser SDKs
- Polyfills and runtime libraries

Add this to `.gitignore` instead:
```gitignore
# Keep dist/ for GitHub installation
# dist/   <-- REMOVE THIS LINE

# But ignore build intermediates
.build/
build/
*.tsbuildinfo
```

---

## 🟡 IMPORTANT: Update GitHub URLs in README

**Priority**: HIGH
**Impact**: Users cannot find/install the library
**Status**: PENDING

### Problem

README.md contains placeholder GitHub URLs:

```markdown
npm install https://github.com/your-org/localretrieve.git
"localretrieve": "github:your-org/localretrieve#main"
```

### Solution

Update all GitHub URLs with the actual repository location:

1. Find-replace `your-org/localretrieve` with actual org/repo
2. Update all installation commands
3. Update clone URLs in Contributing section

Example if repository is `acme-corp/localretrieve`:
```bash
npm install https://github.com/acme-corp/localretrieve.git
```

---

## 🟡 IMPORTANT: Publish to npm

**Priority**: HIGH
**Impact**: npm installation not available
**Status**: PENDING

### Current State

- Package name: `localretrieve`
- Version: `0.1.0`
- Not yet published to npm registry

### Steps to Publish

```bash
# 1. Login to npm
npm login

# 2. Verify package.json
npm publish --dry-run

# 3. Publish (remove --dry-run when ready)
npm publish

# For beta releases
npm publish --tag beta
```

### Pre-publish Checklist

- [ ] Package name is available on npm
- [ ] `package.json` has correct metadata
- [ ] `files` field in package.json includes all needed files
- [ ] README.md is complete
- [ ] LICENSE file exists
- [ ] Build files are included (if not using prepublish script)

---

## 🟢 RECOMMENDED: Add prepublish Script

**Priority**: MEDIUM
**Impact**: Automated build before publishing
**Status**: OPTIONAL

### Enhancement

Add to `package.json`:

```json
{
  "scripts": {
    "prepublishOnly": "npm run build",
    "prepack": "npm run build"
  }
}
```

This ensures the library is always built before publishing to npm.

---

## 🟢 RECOMMENDED: GitHub Releases

**Priority**: MEDIUM
**Impact**: Better version management
**Status**: OPTIONAL

### Enhancement

Set up GitHub releases for version tracking:

1. Tag versions: `git tag -a v0.1.0 -m "Release v0.1.0"`
2. Push tags: `git push origin v0.1.0`
3. Create GitHub Release with changelog

This allows users to install specific versions:
```bash
npm install github:your-org/localretrieve#v0.1.0
```

---

## 🟢 RECOMMENDED: CI/CD for Builds

**Priority**: MEDIUM
**Impact**: Automated testing and builds
**Status**: OPTIONAL

### Enhancement

Add GitHub Actions workflow to:
1. Build the project on every commit
2. Run tests
3. Commit dist/ files automatically (if using Option 1)

Example `.github/workflows/build.yml`:
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Commit built files
        if: github.ref == 'refs/heads/main'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add dist/
          git diff --quiet && git diff --staged --quiet || git commit -m "chore: update built files"
          git push
```

---

## 📋 Summary

### Must Do (Before First Installation)

1. ✅ **Update README.md** - COMPLETED (clearer API docs)
2. 🔴 **Fix .gitignore** - Remove `dist/` exclusion
3. 🔴 **Commit dist/ files** - Run build and commit
4. 🔴 **Update GitHub URLs** - Replace `your-org/localretrieve`

### Should Do (Before Public Release)

5. 🟡 **Publish to npm** - Make package available via npm
6. 🟡 **Create GitHub Releases** - Version management
7. 🟡 **Add LICENSE file** - If not present

### Nice to Have

8. 🟢 **Setup CI/CD** - Automated builds
9. 🟢 **Add badges to README** - Build status, npm version, etc.

---

## Quick Fix Commands

```bash
# 1. Remove dist/ from gitignore (manual edit required)
# Edit .gitignore and comment out or remove line 7: dist/

# 2. Build and commit dist files
npm run build
git add dist/
git commit -m "chore: add prebuilt distribution files for GitHub installation"
git push

# 3. Update README GitHub URLs (manual find-replace)
# Replace "your-org/localretrieve" with actual repository path

# 4. Done! Test installation:
npm install https://github.com/klabulan/browvec.git
```

---

## Verification

After applying fixes, verify:

```bash
# Create test directory
mkdir ../test-install
cd ../test-install

# Test GitHub installation
npm init -y
npm install https://github.com/klabulan/browvec.git

# Verify import works
node -e "import('localretrieve').then(m => console.log('✅ Import successful!', Object.keys(m)))"
```

Expected output:
```
✅ Import successful! ['initLocalRetrieve', 'Database', 'Statement', ...]
```

---

**Last Updated**: 2025-10-01
**Status**: Critical items pending resolution
