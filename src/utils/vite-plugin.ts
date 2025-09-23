import type { Plugin } from 'vite';

export interface LocalRetrieveViteOptions {
  /**
   * Enable COOP/COEP headers for SharedArrayBuffer support
   * @default true
   */
  enableCrossOriginIsolation?: boolean;
  
  /**
   * Custom headers to add
   * @default {}
   */
  customHeaders?: Record<string, string>;
  
  /**
   * Enable HTTPS for local development
   * @default true
   */
  enableHttps?: boolean;
  
  /**
   * Port for development server
   * @default 5173
   */
  port?: number;
}

/**
 * Vite plugin for LocalRetrieve - automatically configures COOP/COEP headers
 * and other requirements for SharedArrayBuffer and OPFS support
 */
export function localRetrieveVitePlugin(options: LocalRetrieveViteOptions = {}): Plugin {
  const {
    enableCrossOriginIsolation = true,
    customHeaders = {},
    enableHttps = true,
    port = 5173
  } = options;

  return {
    name: 'localretrieve',
    configureServer(server) {
      // Add required headers for SharedArrayBuffer and OPFS
      if (enableCrossOriginIsolation) {
        server.middlewares.use((req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          
          // Add custom headers
          Object.entries(customHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          
          next();
        });
      }
    },
    config(config) {
      // Ensure WASM files are handled correctly
      config.assetsInclude = config.assetsInclude || [];
      if (Array.isArray(config.assetsInclude)) {
        config.assetsInclude.push('**/*.wasm');
      }
      
      // Configure worker format
      config.worker = config.worker || {};
      config.worker.format = 'es';
      
      // Configure server if not already set
      if (!config.server) {
        config.server = {};
      }
      
      if (enableHttps && !config.server.https) {
        config.server.https = {};
      }
      
      if (!config.server.port) {
        config.server.port = port;
      }
      
      // Optimize deps
      config.optimizeDeps = config.optimizeDeps || {};
      config.optimizeDeps.exclude = config.optimizeDeps.exclude || [];
      if (Array.isArray(config.optimizeDeps.exclude)) {
        config.optimizeDeps.exclude.push('sqlite3.wasm');
      }
      
      return config;
    }
  };
}

/**
 * Helper function to create a complete Vite config for LocalRetrieve projects
 */
export function createLocalRetrieveConfig(userConfig: any = {}) {
  return {
    ...userConfig,
    plugins: [
      ...(userConfig.plugins || []),
      localRetrieveVitePlugin()
    ],
    server: {
      host: true,
      https: {},
      ...userConfig.server,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        ...userConfig.server?.headers
      }
    },
    worker: {
      format: 'es',
      ...userConfig.worker
    },
    assetsInclude: [
      '**/*.wasm',
      ...(userConfig.assetsInclude || [])
    ],
    optimizeDeps: {
      ...userConfig.optimizeDeps,
      exclude: [
        'sqlite3.wasm',
        ...(userConfig.optimizeDeps?.exclude || [])
      ]
    }
  };
}

/**
 * Check if the current environment supports LocalRetrieve requirements
 */
export function checkEnvironmentSupport(): {
  opfs: boolean;
  sharedArrayBuffer: boolean;
  webWorkers: boolean;
  wasm: boolean;
  crossOriginIsolated: boolean;
  recommendations: string[];
} {
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
  const hasOPFS = typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  const hasWebWorkers = typeof Worker !== 'undefined';
  const hasWasm = typeof WebAssembly !== 'undefined';
  const isCrossOriginIsolated = typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false;
  
  const recommendations: string[] = [];
  
  if (!isSecureContext) {
    recommendations.push('Enable HTTPS for your development server');
  }
  
  if (!hasSharedArrayBuffer || !isCrossOriginIsolated) {
    recommendations.push('Add COOP/COEP headers: Cross-Origin-Opener-Policy: same-origin, Cross-Origin-Embedder-Policy: require-corp');
  }
  
  if (!hasOPFS) {
    recommendations.push('OPFS not available - data will not persist across sessions');
  }
  
  return {
    opfs: hasOPFS,
    sharedArrayBuffer: hasSharedArrayBuffer,
    webWorkers: hasWebWorkers,
    wasm: hasWasm,
    crossOriginIsolated: isCrossOriginIsolated,
    recommendations
  };
}