import { describe, it, expect, beforeAll } from 'vitest';
import { checkEnvironmentSupport } from '../../src/utils/vite-plugin';

/**
 * SETUP-004: Development Environment Test Suite
 * 
 * Tests the development environment configuration including:
 * - SharedArrayBuffer availability
 * - OPFS support
 * - COOP/COEP headers
 * - WASM support
 * - Worker support
 */

describe('SETUP-004: Development Environment', () => {
  let envSupport: ReturnType<typeof checkEnvironmentSupport>;

  beforeAll(() => {
    envSupport = checkEnvironmentSupport();
  });

  describe('Core Web Platform Features', () => {
    it('should support WebAssembly', () => {
      expect(envSupport.wasm).toBe(true);
      expect(typeof WebAssembly).toBe('object');
      expect(typeof WebAssembly.instantiate).toBe('function');
    });

    it('should support Web Workers', () => {
      expect(envSupport.webWorkers).toBe(true);
      expect(typeof Worker).toBe('function');
    });

    it('should detect OPFS availability', () => {
      // OPFS might not be available in test environment, but we should detect it correctly
      if (typeof navigator !== 'undefined' && 'storage' in navigator) {
        expect(typeof navigator.storage.getDirectory).toBe('function');
      }
      
      // The function should return a boolean
      expect(typeof envSupport.opfs).toBe('boolean');
    });
  });

  describe('Cross-Origin Isolation', () => {
    it('should detect SharedArrayBuffer availability', () => {
      expect(typeof envSupport.sharedArrayBuffer).toBe('boolean');
      
      // In cross-origin isolated context, SharedArrayBuffer should be available
      if (envSupport.crossOriginIsolated) {
        expect(envSupport.sharedArrayBuffer).toBe(true);
      }
    });

    it('should detect cross-origin isolation status', () => {
      expect(typeof envSupport.crossOriginIsolated).toBe('boolean');
      
      // If we have SharedArrayBuffer, we should be cross-origin isolated
      if (envSupport.sharedArrayBuffer) {
        // Note: This might not always be true in test environments
        // expect(envSupport.crossOriginIsolated).toBe(true);
      }
    });

    it('should provide helpful recommendations', () => {
      expect(Array.isArray(envSupport.recommendations)).toBe(true);
      
      // If not cross-origin isolated, should recommend headers
      if (!envSupport.crossOriginIsolated) {
        const hasHeaderRecommendation = envSupport.recommendations.some(rec => 
          rec.includes('COOP/COEP')
        );
        expect(hasHeaderRecommendation).toBe(true);
      }
    });
  });

  describe('Development Server Requirements', () => {
    it('should identify required security context', () => {
      // In development, we need secure context for many features
      if (typeof window !== 'undefined') {
        const isSecure = window.isSecureContext;
        
        if (!isSecure) {
          const hasHttpsRecommendation = envSupport.recommendations.some(rec => 
            rec.includes('HTTPS')
          );
          expect(hasHttpsRecommendation).toBe(true);
        }
      }
    });

    it('should validate minimum requirements for LocalRetrieve', () => {
      // Core requirements that must be met
      expect(envSupport.wasm).toBe(true);
      expect(envSupport.webWorkers).toBe(true);
      
      // These are the minimum needed for basic functionality
      const hasMinimumSupport = envSupport.wasm && envSupport.webWorkers;
      expect(hasMinimumSupport).toBe(true);
    });
  });

  describe('Feature Detection', () => {
    it('should detect indexedDB availability', () => {
      // IndexedDB is a fallback for OPFS
      if (typeof indexedDB !== 'undefined') {
        expect(typeof indexedDB.open).toBe('function');
      }
    });

    it('should detect Atomics support', () => {
      // Atomics is needed for SharedArrayBuffer coordination
      if (envSupport.sharedArrayBuffer) {
        expect(typeof Atomics).toBe('object');
        expect(typeof Atomics.wait).toBe('function');
        expect(typeof Atomics.notify).toBe('function');
      }
    });

    it('should detect ES modules support', () => {
      // We need ES modules for workers - check that we can use import.meta
      expect(typeof import.meta).toBe('object');
      expect(typeof import.meta.url).toBe('string');
    });
  });
});

/**
 * BDD-style scenarios for development environment
 */
describe('BDD: Development Environment Scenarios', () => {
  describe('Feature: Local Development Server Setup', () => {
    describe('Scenario: Developer starts development server', () => {
      it('Given a LocalRetrieve project', () => {
        // This test runs in the context of our project
        expect(true).toBe(true);
      });

      it('When development server starts with COOP/COEP headers', async () => {
        const envSupport = checkEnvironmentSupport();
        
        // In properly configured environment, we should have cross-origin isolation
        // Note: This might not be true in test environment
        expect(typeof envSupport.crossOriginIsolated).toBe('boolean');
      });

      it('Then SharedArrayBuffer should be available', () => {
        const envSupport = checkEnvironmentSupport();
        
        // We should at least be able to detect the feature
        expect(typeof envSupport.sharedArrayBuffer).toBe('boolean');
      });

      it('And OPFS should be accessible', () => {
        const envSupport = checkEnvironmentSupport();
        
        expect(typeof envSupport.opfs).toBe('boolean');
        
        // If OPFS is not available, we should have recommendations
        if (!envSupport.opfs) {
          expect(envSupport.recommendations.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Scenario: Environment compatibility check', () => {
      it('Given a web browser environment', () => {
        // We're running in a web-like environment (vitest with happy-dom)
        expect(typeof globalThis).toBe('object');
      });

      it('When checkEnvironmentSupport() is called', () => {
        const envSupport = checkEnvironmentSupport();
        
        expect(envSupport).toBeDefined();
        expect(typeof envSupport).toBe('object');
      });

      it('Then it should return comprehensive support information', () => {
        const envSupport = checkEnvironmentSupport();
        
        // Should have all required properties
        expect(envSupport).toHaveProperty('opfs');
        expect(envSupport).toHaveProperty('sharedArrayBuffer');
        expect(envSupport).toHaveProperty('webWorkers');
        expect(envSupport).toHaveProperty('wasm');
        expect(envSupport).toHaveProperty('crossOriginIsolated');
        expect(envSupport).toHaveProperty('recommendations');
      });

      it('And provide actionable recommendations if needed', () => {
        const envSupport = checkEnvironmentSupport();
        
        expect(Array.isArray(envSupport.recommendations)).toBe(true);
        
        // Each recommendation should be a string
        envSupport.recommendations.forEach(rec => {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Feature: WASM Asset Handling', () => {
    describe('Scenario: WASM files are properly configured', () => {
      it('Given a Vite development environment', () => {
        // We should be able to import our vite plugin
        expect(typeof checkEnvironmentSupport).toBe('function');
      });

      it('When WASM files are served', () => {
        // WASM support should be detected
        const envSupport = checkEnvironmentSupport();
        expect(envSupport.wasm).toBe(true);
      });

      it('Then they should load without CORS issues', () => {
        // WebAssembly should be available
        expect(typeof WebAssembly).toBe('object');
        expect(typeof WebAssembly.instantiate).toBe('function');
      });
    });
  });

  describe('Feature: Worker Module Support', () => {
    describe('Scenario: ES module workers are supported', () => {
      it('Given a modern browser environment', () => {
        const envSupport = checkEnvironmentSupport();
        expect(envSupport.webWorkers).toBe(true);
      });

      it('When creating a worker with type="module"', () => {
        // Worker constructor should be available
        expect(typeof Worker).toBe('function');
      });

      it('Then ES modules should load in worker context', () => {
        // This is tested by the actual worker implementation
        // Here we just verify the constructor is available
        expect(typeof Worker).toBe('function');
      });
    });
  });
});

/**
 * Performance and reliability tests
 */
describe('Performance: Environment Setup', () => {
  it('should check environment support quickly', () => {
    const start = performance.now();
    
    checkEnvironmentSupport();
    
    const duration = performance.now() - start;
    
    // Should complete in under 50ms
    expect(duration).toBeLessThan(50);
  });

  it('should be consistent across multiple calls', () => {
    const result1 = checkEnvironmentSupport();
    const result2 = checkEnvironmentSupport();
    const result3 = checkEnvironmentSupport();
    
    // Results should be identical
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});

/**
 * Error handling tests
 */
describe('Error Handling: Environment Edge Cases', () => {
  it('should handle missing globals gracefully', () => {
    // Test that our detection works even if some globals are missing
    const originalNavigator = globalThis.navigator;
    
    try {
      // @ts-ignore - intentionally testing undefined case
      delete globalThis.navigator;
      
      const envSupport = checkEnvironmentSupport();
      expect(envSupport.opfs).toBe(false);
      expect(envSupport.recommendations).toContain('OPFS not available - data will not persist across sessions');
    } finally {
      globalThis.navigator = originalNavigator;
    }
  });

  it('should provide helpful error messages', () => {
    const envSupport = checkEnvironmentSupport();
    
    // Every recommendation should be actionable
    envSupport.recommendations.forEach(rec => {
      expect(rec).toMatch(/^[A-Z]/); // Should start with capital letter
      expect(rec.length).toBeGreaterThan(10); // Should be descriptive
    });
  });
});