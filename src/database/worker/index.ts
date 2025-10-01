/**
 * Worker Entry Point
 *
 * Main entry point for the refactored database worker with modular architecture.
 * This file replaces the old monolithic worker.ts file.
 */

import { DatabaseWorker } from './core/DatabaseWorker.js';

// Initialize and start the worker
const worker = new DatabaseWorker();

// Handle any unhandled errors
self.addEventListener('error', (event) => {
  console.error('[Worker] Unhandled error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Worker] Unhandled promise rejection:', event.reason);
});

export { DatabaseWorker };