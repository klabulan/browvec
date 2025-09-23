/**
 * RPC Utilities for Worker Communication
 * 
 * This module provides a robust RPC (Remote Procedure Call) system for
 * communication between the main thread and database worker.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  WorkerMethodName,
  DBWorkerAPI,
  WorkerConfig
} from '../types/worker.js';

import {
  WorkerError
} from '../types/worker.js';

// Default configuration
const DEFAULT_CONFIG: Required<WorkerConfig> = {
  maxConcurrentOperations: 10,
  operationTimeout: 30000, // 30 seconds
  enablePerformanceMonitoring: true,
  logLevel: 'info'
};

/**
 * Client-side RPC wrapper for worker communication
 */
export class WorkerRPC implements DBWorkerAPI {
  private worker: Worker;
  private config: Required<WorkerConfig>;
  private pendingCalls = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    startTime: number;
  }>();
  private callCounter = 0;
  private performanceMetrics = {
    totalCalls: 0,
    totalTime: 0,
    errors: 0,
    timeouts: 0
  };

  constructor(worker: Worker, config: Partial<WorkerConfig> = {}) {
    this.worker = worker;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupWorkerListeners();
  }

  private setupWorkerListeners(): void {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse | any>) => {
      const response = event.data;

      // Handle worker log messages
      if (response.type === 'log') {
        const level = response.level as 'debug' | 'info' | 'warn' | 'error';
        const logFn = (console[level] || console.log) as (...args: any[]) => void;
        logFn(response.message, ...(response.args || []));
        return;
      }

      this.handleWorkerResponse(response);
    };

    this.worker.onerror = (error: ErrorEvent) => {
      this.log('error', 'Worker error:', error.message);
      this.rejectAllPending(new WorkerError('Worker error: ' + error.message, 'WORKER_ERROR'));
    };

    this.worker.onmessageerror = (event: MessageEvent) => {
      this.log('error', 'Worker message error:', event);
      this.rejectAllPending(new WorkerError('Worker message error', 'MESSAGE_ERROR'));
    };
  }

  private handleWorkerResponse(response: WorkerResponse): void {
    const pending = this.pendingCalls.get(response.id);
    if (!pending) {
      this.log('warn', 'Received response for unknown call ID:', response.id);
      return;
    }

    this.pendingCalls.delete(response.id);
    clearTimeout(pending.timeout);

    // Update performance metrics
    if (this.config.enablePerformanceMonitoring) {
      const duration = Date.now() - pending.startTime;
      this.performanceMetrics.totalCalls++;
      this.performanceMetrics.totalTime += duration;
    }

    if (response.error) {
      this.performanceMetrics.errors++;
      const error = new WorkerError(
        response.error.message,
        response.error.code
      );
      if (response.error.stack) {
        error.stack = response.error.stack;
      }
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  private generateCallId(): string {
    return `rpc_${++this.callCounter}_${Date.now()}`;
  }

  private call<T = any>(method: WorkerMethodName, params?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check concurrent operations limit
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        this.log('error', `Rate limit exceeded for ${method}: ${this.pendingCalls.size}/${this.config.maxConcurrentOperations}`);
        reject(new WorkerError(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          'RATE_LIMIT'
        ));
        return;
      }

      const id = this.generateCallId();
      const startTime = Date.now();

      // Setup timeout
      const timeout = setTimeout(() => {
        this.log('error', `Operation timeout for ${method} after ${this.config.operationTimeout}ms`);
        this.pendingCalls.delete(id);
        this.performanceMetrics.timeouts++;
        reject(new WorkerError(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          'TIMEOUT'
        ));
      }, this.config.operationTimeout);

      // Store pending call
      this.pendingCalls.set(id, {
        resolve,
        reject,
        timeout,
        startTime
      });

      // Send message to worker
      const message: WorkerMessage = {
        id,
        method,
        params
      };

      try {
        this.worker.postMessage(message);
      } catch (error) {
        this.log('error', `Failed to send RPC message for ${method}:`, error);
        this.pendingCalls.delete(id);
        clearTimeout(timeout);
        reject(new WorkerError(
          `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
          'SEND_ERROR'
        ));
      }
    });
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingCalls.clear();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      console[level](`[WorkerRPC] ${message}`, ...args);
    }
  }

  // DBWorkerAPI implementation
  async open(params: Parameters<DBWorkerAPI['open']>[0]): Promise<void> {
    return this.call('open', params);
  }

  async close(): Promise<void> {
    const result = await this.call('close');
    // Clean up any pending calls after close
    this.rejectAllPending(new WorkerError('Worker closed', 'WORKER_CLOSED'));
    return result;
  }

  async exec(params: Parameters<DBWorkerAPI['exec']>[0]): Promise<void> {
    return this.call('exec', params);
  }

  async select(params: Parameters<DBWorkerAPI['select']>[0]) {
    return this.call('select', params);
  }

  async bulkInsert(params: Parameters<DBWorkerAPI['bulkInsert']>[0]): Promise<void> {
    return this.call('bulkInsert', params);
  }

  async initVecExtension(): Promise<void> {
    return this.call('initVecExtension');
  }

  async initializeSchema(): Promise<void> {
    return this.call('initializeSchema');
  }

  async getCollectionInfo(name: string) {
    return this.call('getCollectionInfo', name);
  }

  async search(params: Parameters<DBWorkerAPI['search']>[0]) {
    return this.call('search', params);
  }

  async export(params?: Parameters<DBWorkerAPI['export']>[0]): Promise<Uint8Array> {
    return this.call('export', params);
  }

  async import(params: Parameters<DBWorkerAPI['import']>[0]): Promise<void> {
    return this.call('import', params);
  }

  async clear(): Promise<void> {
    return this.call('clear');
  }

  async getVersion() {
    return this.call('getVersion');
  }

  async getStats() {
    return this.call('getStats');
  }

  // Collection management with embedding support
  async createCollection(params: Parameters<DBWorkerAPI['createCollection']>[0]): Promise<void> {
    return this.call('createCollection', params);
  }

  async getCollectionEmbeddingStatus(collection: string) {
    return this.call('getCollectionEmbeddingStatus', collection);
  }

  // Document operations with embedding support
  async insertDocumentWithEmbedding(params: Parameters<DBWorkerAPI['insertDocumentWithEmbedding']>[0]) {
    return this.call('insertDocumentWithEmbedding', params);
  }

  // Search operations
  async searchSemantic(params: Parameters<DBWorkerAPI['searchSemantic']>[0]) {
    return this.call('searchSemantic', params);
  }

  // Embedding generation operations
  async generateEmbedding(params: Parameters<DBWorkerAPI['generateEmbedding']>[0]) {
    return this.call('generateEmbedding', params);
  }

  async batchGenerateEmbeddings(params: Parameters<DBWorkerAPI['batchGenerateEmbeddings']>[0]) {
    return this.call('batchGenerateEmbeddings', params);
  }

  async regenerateCollectionEmbeddings(collection: string, options?: Parameters<DBWorkerAPI['regenerateCollectionEmbeddings']>[1]) {
    return this.call('regenerateCollectionEmbeddings', { collection, options });
  }

  // Utility methods
  getPerformanceMetrics() {
    const avgLatency = this.performanceMetrics.totalCalls > 0 
      ? this.performanceMetrics.totalTime / this.performanceMetrics.totalCalls 
      : 0;

    return {
      ...this.performanceMetrics,
      averageLatency: avgLatency,
      pendingOperations: this.pendingCalls.size,
      successRate: this.performanceMetrics.totalCalls > 0
        ? (this.performanceMetrics.totalCalls - this.performanceMetrics.errors) / this.performanceMetrics.totalCalls
        : 1
    };
  }

  terminate(): void {
    this.rejectAllPending(new WorkerError('Worker terminated', 'TERMINATED'));
    this.worker.terminate();
  }
}

/**
 * Server-side RPC handler for the worker
 */
export class WorkerRPCHandler {
  private handlers = new Map<string, (params: any) => Promise<any>>();
  private config: Required<WorkerConfig>;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      await this.handleMessage(message);
    };
  }

  private async handleMessage(message: WorkerMessage): Promise<void> {
    const startTime = Date.now();
    let response: WorkerResponse;

    try {

      const handler = this.handlers.get(message.method);
      if (!handler) {
        throw new WorkerError(`Unknown method: ${message.method}`, 'UNKNOWN_METHOD');
      }

      const result = await handler(message.params);

      response = {
        id: message.id,
        result
      };
    } catch (error) {
      this.log('error', `Method ${message.method} failed:`, error);
      
      response = {
        id: message.id,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof WorkerError ? error.code : 'UNKNOWN_ERROR',
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }

    try {
      self.postMessage(response);
    } catch (postError) {
      this.log('error', 'Failed to post response:', postError);
      
      // Try to send a simpler error response
      const errorResponse: WorkerResponse = {
        id: message.id,
        error: {
          message: 'Failed to serialize response',
          code: 'SERIALIZATION_ERROR'
        }
      };
      
      try {
        self.postMessage(errorResponse);
      } catch (finalError) {
        this.log('error', 'Failed to send error response:', finalError);
      }
    }
  }

  register(method: string, handler: (params: any) => Promise<any>): void {
    this.handlers.set(method, handler);
    this.log('debug', `Registered handler for method: ${method}`);
  }

  unregister(method: string): void {
    this.handlers.delete(method);
    this.log('debug', `Unregistered handler for method: ${method}`);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      console[level](`[WorkerRPCHandler] ${message}`, ...args);
    }
  }
}

/**
 * Utility function to create a typed RPC client
 */
export function createWorkerRPC(
  workerUrl: string | URL, 
  config?: Partial<WorkerConfig>
): WorkerRPC {
  const worker = new Worker(workerUrl, { type: 'module' });
  return new WorkerRPC(worker, config);
}

/**
 * Helper for handling transferable objects in RPC calls
 */
export function createTransferableMessage<T = any>(
  message: WorkerMessage<T>,
  transferables: Transferable[] = []
): [WorkerMessage<T>, Transferable[]] {
  return [message, transferables];
}

/**
 * Error handling utilities
 */
export function isWorkerError(error: any): error is WorkerError {
  return error instanceof Error && error.name === 'WorkerError';
}

export function createTimeoutError(timeout: number): WorkerError {
  return new WorkerError(
    `Operation timed out after ${timeout}ms`,
    'TIMEOUT'
  );
}