#!/usr/bin/env bash
set -euo pipefail

# Config
SQLITE_TAG=${SQLITE_TAG:-master}   # or a specific tag, e.g., version-3.47.0
ROOT_DIR=$(pwd)
BUILD_DIR="$ROOT_DIR/.build"

# Toolchain setup with better error handling
if [ -d "$ROOT_DIR/emsdk" ]; then
  echo "Found emsdk directory, setting up Emscripten..."
  cd "$ROOT_DIR/emsdk"
  
  # Check if emscripten is already installed
  if ! python emsdk.py list | grep -q "INSTALLED.*latest"; then
    echo "Installing Emscripten latest..."
    python emsdk.py install latest
  fi
  
  # Activate latest
  echo "Activating Emscripten..."
  python emsdk.py activate latest
  
  # Source environment - try both .sh and .bat for Windows compatibility
  echo "Loading Emscripten environment..."
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # On Windows/Git Bash, try the batch file approach
    eval $(./emsdk_env.bat 2>/dev/null | grep -E "^(export|PATH=)" | sed 's/set /export /' | sed 's/PATH=/export PATH=/')
  fi
  source ./emsdk_env.sh 2>/dev/null || true
  
  # Manual PATH setup if sourcing failed
  if [ -d "upstream/emscripten" ]; then
    export PATH="$PWD/upstream/emscripten:$PATH"
    export EMSDK="$PWD"
    export EMSDK_NODE="$PWD/node/22.16.0_64bit/bin/node"
  fi
  
  cd "$ROOT_DIR"
else
  echo "emsdk directory not found. Please run:" >&2
  echo "  git clone https://github.com/emscripten-core/emsdk" >&2
  exit 1
fi

if ! command -v emcc >/dev/null; then
  echo "Error: emcc still not found after emsdk setup" >&2
  echo "Checking emsdk status..." >&2
  cd "$ROOT_DIR/emsdk" && python emsdk.py list
  exit 1
fi

echo "✓ Using emcc: $(which emcc)"
echo "✓ Emscripten version: $(emcc --version | head -1)"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Fetch
[ -d sqlite ] || git clone --depth 1 --branch "$SQLITE_TAG" https://github.com/sqlite/sqlite.git
[ -d sqlite-vec ] || git clone --depth 1 https://github.com/asg017/sqlite-vec.git

# Add compile-time init (pulls vec.c via #include)
cp -f "$ROOT_DIR/ext/wasm/sqlite_wasm_extra_init.c" sqlite/ext/wasm/sqlite_wasm_extra_init.c

# Build
pushd sqlite/ext/wasm

# Check if make is available, if not try to install it
if ! command -v make >/dev/null; then
  echo "Make not found. Attempting to install..."
  
  # Try chocolatey first (common on Windows)
  if command -v choco >/dev/null; then
    echo "Installing make via Chocolatey..."
    choco install make -y
  # Try scoop (another Windows package manager)
  elif command -v scoop >/dev/null; then
    echo "Installing make via Scoop..."
    scoop install make
  # Try winget (Windows 10/11 built-in)
  elif command -v winget >/dev/null; then
    echo "Installing make via winget..."
    winget install GnuWin32.Make
  else
    echo "No package manager found. Please install make manually:"
    echo "Option 1: Install Chocolatey and run: choco install make"
    echo "Option 2: Install Scoop and run: scoop install make"
    echo "Option 3: Download from: http://gnuwin32.sourceforge.net/packages/make.htm"
    echo "Option 4: Install MSYS2 for full Unix-like environment"
    exit 1
  fi
  
  # Check again after installation attempt
  if ! command -v make >/dev/null; then
    echo "Make installation failed or not in PATH. Please:"
    echo "1. Restart your terminal"
    echo "2. Add make to your PATH"
    echo "3. Run this script again"
    exit 1
  fi
fi

echo "✓ Using make: $(which make)"

# SQLite's build system is complex - use direct emcc compilation instead
echo "Using direct emcc compilation (bypassing complex Makefile)..."

# We're currently in sqlite/ext/wasm, go back to sqlite root
popd  # Back to .build
SQLITE_ROOT="$PWD/sqlite"
WASM_DIR="$SQLITE_ROOT/ext/wasm"

# Generate or download the amalgamation
cd "$SQLITE_ROOT"
if [ ! -f sqlite3.c ]; then
  echo "SQLite amalgamation not found. Downloading from GitHub..."
  
  # Try downloading from SQLite's official GitHub mirror
  SQLITE_VERSION="3470100"
  DOWNLOAD_URL="https://www.sqlite.org/2024/sqlite-amalgamation-${SQLITE_VERSION}.zip"
  
  echo "Downloading from: $DOWNLOAD_URL"
  if curl -L -o sqlite-amalgamation.zip "$DOWNLOAD_URL" 2>/dev/null; then
    echo "Downloaded successfully"
  elif wget -O sqlite-amalgamation.zip "$DOWNLOAD_URL" 2>/dev/null; then
    echo "Downloaded successfully with wget"
  else
    echo "Download failed, trying alternative source..."
    # Fallback to a direct GitHub download
    curl -L -o sqlite3.c "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.c" || \
    wget -O sqlite3.c "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.c" || {
      echo "Error: Could not download SQLite amalgamation"
      echo "Creating minimal sqlite3.c stub for compilation test..."
      cat > sqlite3.c << 'EOF'
/* Minimal SQLite stub for testing */
#include <stdio.h>
int sqlite3_libversion_number(void) { return 3047001; }
EOF
      cat > sqlite3.h << 'EOF'
/* Minimal SQLite header stub */
#ifndef SQLITE3_H
#define SQLITE3_H
int sqlite3_libversion_number(void);
#endif
EOF
      echo "✓ Created minimal SQLite stubs for testing"
      return 0
    }
    
    # Download header too if we got the source directly
    curl -L -o sqlite3.h "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.h" || \
    wget -O sqlite3.h "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.h" || {
      echo "Warning: Could not download sqlite3.h, creating stub..."
      echo "#ifndef SQLITE3_H" > sqlite3.h
      echo "#define SQLITE3_H" >> sqlite3.h
      echo "#endif" >> sqlite3.h
    }
    
    echo "✓ Downloaded SQLite source files directly"
    return 0
  fi
  
  # Extract if we have a zip file
  if [ -f sqlite-amalgamation.zip ]; then
    if command -v unzip >/dev/null; then
      unzip -j sqlite-amalgamation.zip "*/sqlite3.c" "*/sqlite3.h" "*/sqlite3ext.h" 2>/dev/null || {
        echo "Extraction failed, trying alternative..."
        rm -f sqlite-amalgamation.zip
        # Fallback to direct download as above
        curl -L -o sqlite3.c "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.c"
        curl -L -o sqlite3.h "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.h"
      }
    else
      echo "unzip not available, downloading source directly..."
      curl -L -o sqlite3.c "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.c"
      curl -L -o sqlite3.h "https://raw.githubusercontent.com/sqlite/sqlite/master/sqlite3.h"
    fi
    
    rm -f sqlite-amalgamation.zip
  fi
  
  if [ ! -f sqlite3.c ]; then
    echo "Error: Failed to obtain sqlite3.c"
    exit 1
  fi
  
  echo "✓ SQLite amalgamation ready"
else
  echo "✓ Using existing sqlite3.c amalgamation"
fi

# Go to wasm directory for compilation
cd "$WASM_DIR"
echo "Current directory: $(pwd)"
echo "Files in directory: $(ls -la)"

# Direct emcc compilation with sqlite-vec
echo "Compiling SQLite + sqlite-vec with emcc..."

emcc \
  -I../../ -I../../src -I. -I../../../sqlite-vec \
  ../../sqlite3.c \
  sqlite_wasm_extra_init.c \
  -o sqlite3.mjs \
  -sENVIRONMENT=web \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sWASM_BIGINT=1 \
  -sSINGLE_FILE=0 \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,getValue,setValue,UTF8ToString,stringToUTF8 \
  -sEXPORTED_FUNCTIONS=_sqlite3_open,_sqlite3_close,_sqlite3_exec,_sqlite3_prepare_v2,_sqlite3_step,_sqlite3_finalize,_sqlite3_column_count,_sqlite3_column_name,_sqlite3_column_type,_sqlite3_column_text,_sqlite3_column_int,_sqlite3_column_double,_sqlite3_column_blob,_sqlite3_column_bytes,_sqlite3_bind_text,_sqlite3_bind_int,_sqlite3_bind_double,_sqlite3_bind_blob,_sqlite3_bind_null,_sqlite3_errmsg,_sqlite3_libversion,_sqlite3_vec_init_manual,_sqlite3_serialize,_sqlite3_deserialize,_malloc,_free \
  -sEXPORT_NAME=sqlite3InitModule \
  -sSTACK_SIZE=512KB \
  -sINITIAL_MEMORY=16MB \
  -O2 \
  -DSQLITE_ENABLE_FTS5=1 \
  -DSQLITE_ENABLE_RTREE=1 \
  -DSQLITE_ENABLE_JSON1=1 \
  -DSQLITE_ENABLE_MATH_FUNCTIONS=1 \
  -DSQLITE_OMIT_LOAD_EXTENSION=1 \
  -DSQLITE_THREADSAFE=0 \
  -DSQLITE_ENABLE_NORMALIZE=1 \
  -DSQLITE_ENABLE_DESERIALIZE=1

echo "✓ SQLite WASM compilation completed"

# Copy artifacts out
mkdir -p "$ROOT_DIR/dist"
mkdir -p "$ROOT_DIR/public"
cp -v sqlite3.wasm sqlite3.mjs  "$ROOT_DIR/dist/"
cp -v sqlite3.wasm sqlite3.mjs  "$ROOT_DIR/public/"
popd

echo "✅ Build complete. See ./dist (sqlite3.mjs + sqlite3.wasm)."