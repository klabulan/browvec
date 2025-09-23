import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Development configuration for LocalRetrieve library itself
export default defineConfig({
  root: '.',
  base: '/',
  
  server: {
    host: true,
    port: 5173,
    // Use HTTP - localhost is treated as secure context by browsers
    open: false,
    
    // CRITICAL: Headers required for SharedArrayBuffer and OPFS
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'database/worker': resolve(__dirname, 'src/database/worker.ts')
      },
      name: 'LocalRetrieve',
      fileName: (format, entryName) => {
        if (entryName === 'database/worker') {
          return 'database/worker.js';
        }
        return 'localretrieve.mjs';
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [],
      output: {
        // Preserve worker as separate file
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  
  worker: {
    format: 'es'
  },
  
  assetsInclude: ['**/*.wasm'],
  
  optimizeDeps: {
    exclude: ['sqlite3.wasm'],
    // Exclude problematic directories from scanning
    entries: [
      'src/**/*',
      'test-*.html',
      '!emsdk/**/*',
      '!.build/**/*',
      '!node_modules/**/*'
    ]
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});