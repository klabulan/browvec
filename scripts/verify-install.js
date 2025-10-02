#!/usr/bin/env node
/**
 * Verifies LocalRetrieve installation has all required files
 * Runs automatically via postinstall hook
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
    'dist/localretrieve.mjs',
    'dist/sqlite3.mjs',
    'dist/sqlite3.wasm',
    'dist/database/worker.js'
];

console.log('🔍 Verifying LocalRetrieve installation...\n');

let missing = [];
let present = [];

for (const file of REQUIRED_FILES) {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);

    if (exists) {
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        present.push(`  ✅ ${file} (${sizeMB} MB)`);
    } else {
        missing.push(`  ❌ ${file}`);
    }
}

if (present.length > 0) {
    console.log('Present:');
    present.forEach(msg => console.log(msg));
    console.log();
}

if (missing.length > 0) {
    console.error('❌ LocalRetrieve installation incomplete!\n');
    console.error('Missing required files:');
    missing.forEach(msg => console.error(msg));
    console.error('\n📋 To fix this:');
    console.error('  1. Clone the repository: git clone https://github.com/klabulan/browvec.git');
    console.error('  2. Build WASM: npm run build:wasm');
    console.error('  3. Build SDK: npm run build:sdk');
    console.error('\n💡 Or install from npm registry once published: npm install localretrieve');
    process.exit(1);
}

console.log('✅ LocalRetrieve installation verified successfully!\n');
