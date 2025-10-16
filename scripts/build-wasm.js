#!/usr/bin/env node

/**
 * Cross-platform WASM build script for SQLite + sqlite-vec
 * Works on Windows, macOS, and Linux without requiring WSL or bash
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SQLITE_TAG = process.env.SQLITE_TAG || 'master';
const ROOT_DIR = process.cwd();
const BUILD_DIR = path.join(ROOT_DIR, '.build');

// Helper functions
function exec(cmd, options = {}) {
  console.log(`> ${cmd}`);
  try {
    return execSync(cmd, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    throw error;
  }
}

function mkdir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function checkCommand(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Main build process
async function build() {
  console.log('🔧 Building SQLite WASM with sqlite-vec extension...\n');

  // 1. Setup Emscripten
  const emsdkDir = path.join(ROOT_DIR, 'emsdk');

  if (!fs.existsSync(emsdkDir)) {
    console.error('❌ emsdk directory not found. Please run:');
    console.error('   git clone https://github.com/emscripten-core/emsdk');
    process.exit(1);
  }

  console.log('📦 Setting up Emscripten...');
  process.chdir(emsdkDir);

  // Check if installed
  if (checkCommand('emcc')) {
    console.log('✓ Emscripten already configured');
  } else {
    // Install if needed
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    try {
      exec(`${pythonCmd} emsdk.py install latest`);
      exec(`${pythonCmd} emsdk.py activate latest`);
    } catch (error) {
      console.error('❌ Failed to install Emscripten');
      console.error('   Make sure Python is installed and in PATH');
      process.exit(1);
    }
  }

  // Set up environment
  const emsdk = path.join(emsdkDir, 'upstream', 'emscripten');
  process.env.PATH = `${emsdk}${path.delimiter}${process.env.PATH}`;
  process.env.EMSDK = emsdkDir;

  // Verify emcc is available
  if (!checkCommand('emcc')) {
    console.error('❌ emcc not found after setup');
    console.error('   Try running: emsdk/emsdk_env.bat (Windows) or source emsdk/emsdk_env.sh (Unix)');
    process.exit(1);
  }

  console.log('✓ Using emcc:', execSync('emcc --version', { encoding: 'utf8' }).split('\n')[0]);

  process.chdir(ROOT_DIR);

  // 2. Create build directory and fetch dependencies
  mkdir(BUILD_DIR);
  process.chdir(BUILD_DIR);

  console.log('\n📥 Fetching SQLite and sqlite-vec...');

  if (!fs.existsSync('sqlite')) {
    exec(`git clone --depth 1 --branch ${SQLITE_TAG} https://github.com/sqlite/sqlite.git`);
  } else {
    console.log('✓ SQLite already cloned');
  }

  if (!fs.existsSync('sqlite-vec')) {
    exec('git clone --depth 1 https://github.com/asg017/sqlite-vec.git');
  } else {
    console.log('✓ sqlite-vec already cloned');
  }

  // 3. Copy extra init file
  const extraInitSrc = path.join(ROOT_DIR, 'ext', 'wasm', 'sqlite_wasm_extra_init.c');
  const extraInitDst = path.join(BUILD_DIR, 'sqlite', 'ext', 'wasm', 'sqlite_wasm_extra_init.c');

  if (fs.existsSync(extraInitSrc)) {
    fs.copyFileSync(extraInitSrc, extraInitDst);
    console.log('✓ Copied sqlite_wasm_extra_init.c');
  }

  // 4. Get SQLite amalgamation
  const sqliteRoot = path.join(BUILD_DIR, 'sqlite');
  const sqlite3c = path.join(sqliteRoot, 'sqlite3.c');

  if (!fs.existsSync(sqlite3c)) {
    console.log('\n📥 Downloading SQLite amalgamation...');

    try {
      const url = 'https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.c';
      const curlCmd = process.platform === 'win32' ?
        `curl -L -o "${sqlite3c}" "${url}"` :
        `curl -L -o ${sqlite3c} ${url}`;

      exec(curlCmd);
      console.log('✓ Downloaded sqlite3.c');
    } catch (error) {
      console.error('❌ Failed to download SQLite amalgamation');
      process.exit(1);
    }
  } else {
    console.log('✓ Using existing sqlite3.c');
  }

  // 5. Compile with emcc
  console.log('\n🔨 Compiling SQLite + sqlite-vec with emcc...');

  const wasmDir = path.join(sqliteRoot, 'ext', 'wasm');
  process.chdir(wasmDir);

  const emccCmd = `emcc \
    -I../../ -I../../src -I. -I../../../sqlite-vec \
    ../../sqlite3.c \
    sqlite_wasm_extra_init.c \
    -o sqlite3.mjs \
    -sENVIRONMENT=web,worker \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sALLOW_MEMORY_GROWTH=1 \
    -sWASM_BIGINT=1 \
    -sSINGLE_FILE=0 \
    -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8,lengthBytesUTF8,writeArrayToMemory \
    -sEXPORTED_FUNCTIONS=_sqlite3_open,_sqlite3_close,_sqlite3_exec,_sqlite3_prepare_v2,_sqlite3_step,_sqlite3_finalize,_sqlite3_column_count,_sqlite3_column_name,_sqlite3_column_type,_sqlite3_column_text,_sqlite3_column_int,_sqlite3_column_double,_sqlite3_column_blob,_sqlite3_column_bytes,_sqlite3_bind_text,_sqlite3_bind_int,_sqlite3_bind_double,_sqlite3_bind_blob,_sqlite3_bind_null,_sqlite3_errmsg,_sqlite3_libversion,_sqlite3_vec_init_manual,_sqlite3_serialize,_sqlite3_deserialize,_malloc,_free \
    -sEXPORT_NAME=sqlite3InitModule \
    -sSTACK_SIZE=512KB \
    -sINITIAL_MEMORY=16MB \
    -sASSERTIONS=1 \
    -O2 \
    -DSQLITE_ENABLE_FTS5=1 \
    -DSQLITE_ENABLE_RTREE=1 \
    -DSQLITE_ENABLE_JSON1=1 \
    -DSQLITE_ENABLE_MATH_FUNCTIONS=1 \
    -DSQLITE_OMIT_LOAD_EXTENSION=1 \
    -DSQLITE_THREADSAFE=0 \
    -DSQLITE_ENABLE_NORMALIZE=1 \
    -DSQLITE_ENABLE_DESERIALIZE=1`;

  exec(emccCmd.replace(/\s+/g, ' '));

  console.log('✓ SQLite WASM compilation completed');

  // 6. Copy artifacts
  console.log('\n📦 Copying artifacts...');

  const distDir = path.join(ROOT_DIR, 'dist');
  const publicDir = path.join(ROOT_DIR, 'public');

  mkdir(distDir);
  mkdir(publicDir);

  fs.copyFileSync(path.join(wasmDir, 'sqlite3.wasm'), path.join(distDir, 'sqlite3.wasm'));
  fs.copyFileSync(path.join(wasmDir, 'sqlite3.mjs'), path.join(distDir, 'sqlite3.mjs'));
  fs.copyFileSync(path.join(wasmDir, 'sqlite3.wasm'), path.join(publicDir, 'sqlite3.wasm'));
  fs.copyFileSync(path.join(wasmDir, 'sqlite3.mjs'), path.join(publicDir, 'sqlite3.mjs'));

  console.log('✓ Copied to dist/ and public/');

  process.chdir(ROOT_DIR);

  console.log('\n✅ Build complete!');
  console.log('   Files: dist/sqlite3.mjs + dist/sqlite3.wasm');
}

// Run build
build().catch(error => {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
});
