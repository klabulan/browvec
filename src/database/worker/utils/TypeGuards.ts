/**
 * TypeGuards
 *
 * Runtime type validation utilities for ensuring data integrity and type safety
 * in worker operations.
 */

import type {
  SQLValue,
  SQLParams,
  OpenDatabaseParams,
  ExecParams,
  SelectParams,
  BulkInsertParams,
  SearchRequest,
  CreateCollectionParams,
  InsertDocumentWithEmbeddingParams,
  SemanticSearchParams,
  ExportParams,
  ImportParams,
  GenerateEmbeddingRequest,
  BatchEmbeddingRequest,
  EnqueueEmbeddingParams,
  ProcessEmbeddingQueueParams,
  ClearEmbeddingQueueParams
} from '../../../types/worker.js';

/**
 * Type guard for SQLValue
 */
export function isSQLValue(value: any): value is SQLValue {
  return value === null ||
         value === undefined ||
         typeof value === 'string' ||
         typeof value === 'number' ||
         value instanceof Uint8Array ||
         value instanceof Float32Array;
}

/**
 * Type guard for SQLParams array
 */
export function isSQLParams(params: any): params is SQLParams {
  return Array.isArray(params) && params.every(isSQLValue);
}

/**
 * Type guard for OpenDatabaseParams
 */
export function isOpenDatabaseParams(params: any): params is OpenDatabaseParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.filename === 'string' &&
         (params.path === undefined || typeof params.path === 'string') &&
         (params.vfs === undefined || params.vfs === 'opfs' || params.vfs === 'opfs-sahpool') &&
         (params.pragmas === undefined || (typeof params.pragmas === 'object' && params.pragmas !== null));
}

/**
 * Type guard for ExecParams
 */
export function isExecParams(params: any): params is ExecParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.sql === 'string' &&
         (params.params === undefined || isSQLParams(params.params));
}

/**
 * Type guard for SelectParams
 */
export function isSelectParams(params: any): params is SelectParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.sql === 'string' &&
         (params.params === undefined || isSQLParams(params.params));
}

/**
 * Type guard for BulkInsertParams
 */
export function isBulkInsertParams(params: any): params is BulkInsertParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.tableName === 'string' &&
         Array.isArray(params.data) &&
         params.data.every((row: any) =>
           typeof row === 'object' &&
           row !== null &&
           !Array.isArray(row)
         );
}

/**
 * Type guard for SearchRequest
 */
export function isSearchRequest(params: any): params is SearchRequest {
  return typeof params === 'object' &&
         params !== null &&
         (typeof params.query === 'string' || typeof params.vector === 'object') &&
         (params.collection === undefined || typeof params.collection === 'string') &&
         (params.limit === undefined || typeof params.limit === 'number') &&
         (params.threshold === undefined || typeof params.threshold === 'number') &&
         (params.hybrid === undefined || typeof params.hybrid === 'boolean');
}

/**
 * Type guard for CreateCollectionParams
 */
export function isCreateCollectionParams(params: any): params is CreateCollectionParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.name === 'string' &&
         (params.dimensions === undefined || typeof params.dimensions === 'number') &&
         (params.config === undefined || (typeof params.config === 'object' && params.config !== null));
}

/**
 * Type guard for InsertDocumentWithEmbeddingParams
 */
export function isInsertDocumentWithEmbeddingParams(params: any): params is InsertDocumentWithEmbeddingParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.collection === 'string' &&
         typeof params.id === 'string' &&
         typeof params.content === 'string' &&
         (params.title === undefined || typeof params.title === 'string') &&
         (params.metadata === undefined || (typeof params.metadata === 'object' && params.metadata !== null)) &&
         (params.embedding === undefined || isFloat32Array(params.embedding)) &&
         (params.skipEmbedding === undefined || typeof params.skipEmbedding === 'boolean');
}

/**
 * Type guard for SemanticSearchParams
 */
export function isSemanticSearchParams(params: any): params is SemanticSearchParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.collection === 'string' &&
         typeof params.query === 'string' &&
         (params.limit === undefined || typeof params.limit === 'number') &&
         (params.threshold === undefined || typeof params.threshold === 'number');
}

/**
 * Type guard for ExportParams
 */
export function isExportParams(params: any): params is ExportParams {
  return params === undefined ||
         (typeof params === 'object' &&
          params !== null &&
          (params.format === undefined || typeof params.format === 'string'));
}

/**
 * Type guard for ImportParams
 */
export function isImportParams(params: any): params is ImportParams {
  return typeof params === 'object' &&
         params !== null &&
         (params.data instanceof Uint8Array || params.data instanceof ArrayBuffer) &&
         (params.overwrite === undefined || typeof params.overwrite === 'boolean');
}

/**
 * Type guard for GenerateEmbeddingRequest
 */
export function isGenerateEmbeddingRequest(params: any): params is GenerateEmbeddingRequest {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.collection === 'string' &&
         typeof params.content === 'string' &&
         (params.options === undefined || (typeof params.options === 'object' && params.options !== null));
}

/**
 * Type guard for BatchEmbeddingRequest
 */
export function isBatchEmbeddingRequest(params: any): params is BatchEmbeddingRequest {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.collection === 'string' &&
         Array.isArray(params.documents) &&
         params.documents.every((doc: any) =>
           typeof doc === 'object' &&
           doc !== null &&
           typeof doc.id === 'string' &&
           typeof doc.content === 'string'
         ) &&
         (params.options === undefined || (typeof params.options === 'object' && params.options !== null));
}

/**
 * Type guard for EnqueueEmbeddingParams
 */
export function isEnqueueEmbeddingParams(params: any): params is EnqueueEmbeddingParams {
  return typeof params === 'object' &&
         params !== null &&
         typeof params.collection === 'string' &&
         typeof params.documentId === 'string' &&
         typeof params.textContent === 'string' &&
         (params.priority === undefined || typeof params.priority === 'number');
}

/**
 * Type guard for ProcessEmbeddingQueueParams
 */
export function isProcessEmbeddingQueueParams(params: any): params is ProcessEmbeddingQueueParams {
  return params === undefined ||
         (typeof params === 'object' &&
          params !== null &&
          (params.collection === undefined || typeof params.collection === 'string') &&
          (params.batchSize === undefined || typeof params.batchSize === 'number') &&
          (params.onProgress === undefined || typeof params.onProgress === 'function'));
}

/**
 * Type guard for ClearEmbeddingQueueParams
 */
export function isClearEmbeddingQueueParams(params: any): params is ClearEmbeddingQueueParams {
  return params === undefined ||
         (typeof params === 'object' &&
          params !== null &&
          (params.collection === undefined || typeof params.collection === 'string') &&
          (params.status === undefined || typeof params.status === 'string'));
}

/**
 * Type guard for Float32Array
 */
export function isFloat32Array(value: any): value is Float32Array {
  return value instanceof Float32Array;
}

/**
 * Type guard for valid collection name
 */
export function isValidCollectionName(name: any): name is string {
  return typeof name === 'string' &&
         name.length > 0 &&
         name.length <= 255 &&
         /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Type guard for valid document ID
 */
export function isValidDocumentId(id: any): id is string {
  return typeof id === 'string' &&
         id.length > 0 &&
         id.length <= 255;
}

/**
 * Type guard for valid embedding vector
 */
export function isValidEmbedding(embedding: any): embedding is Float32Array {
  return embedding instanceof Float32Array &&
         embedding.length > 0 &&
         embedding.length <= 2048; // Reasonable upper limit
}

/**
 * Type guard for JSON-serializable object
 */
export function isJSONSerializable(value: any): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for valid SQL identifier (table/column names)
 */
export function isValidSQLIdentifier(identifier: any): identifier is string {
  return typeof identifier === 'string' &&
         identifier.length > 0 &&
         identifier.length <= 128 &&
         /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
}

/**
 * Type guard for valid limit parameter
 */
export function isValidLimit(limit: any): limit is number {
  return typeof limit === 'number' &&
         Number.isInteger(limit) &&
         limit > 0 &&
         limit <= 10000; // Reasonable upper limit
}

/**
 * Type guard for valid threshold parameter
 */
export function isValidThreshold(threshold: any): threshold is number {
  return typeof threshold === 'number' &&
         threshold >= 0 &&
         threshold <= 1;
}

/**
 * Runtime validation for worker method parameters
 */
export class ParameterValidator {
  /**
   * Validate and sanitize parameters for a worker method
   */
  static validate<T>(
    params: any,
    typeGuard: (params: any) => params is T,
    methodName: string
  ): T {
    if (!typeGuard(params)) {
      throw new Error(`Invalid parameters for ${methodName}: ${JSON.stringify(params)}`);
    }
    return params;
  }

  /**
   * Validate collection name with additional business rules
   */
  static validateCollectionName(name: any, methodName: string): string {
    if (!isValidCollectionName(name)) {
      throw new Error(`Invalid collection name for ${methodName}: must be a non-empty alphanumeric string with underscores/hyphens, max 255 characters`);
    }

    // Additional business rules
    const reservedNames = ['sqlite_master', 'sqlite_temp_master', 'sqlite_sequence'];
    if (reservedNames.includes(name.toLowerCase())) {
      throw new Error(`Collection name '${name}' is reserved`);
    }

    return name;
  }

  /**
   * Validate document ID with additional business rules
   */
  static validateDocumentId(id: any, methodName: string): string {
    if (!isValidDocumentId(id)) {
      throw new Error(`Invalid document ID for ${methodName}: must be a non-empty string, max 255 characters`);
    }
    return id;
  }

  /**
   * Validate and sanitize SQL parameters
   */
  static validateSQLParams(params: any, methodName: string): SQLParams | undefined {
    if (params === undefined) {
      return undefined;
    }

    if (!isSQLParams(params)) {
      throw new Error(`Invalid SQL parameters for ${methodName}: must be an array of SQL values`);
    }

    // Additional validation for parameter safety
    params.forEach((param, index) => {
      if (typeof param === 'string' && param.length > 100000) {
        throw new Error(`SQL parameter ${index} too large (${param.length} chars) for ${methodName}`);
      }
      if (param instanceof Uint8Array && param.length > 10000000) { // 10MB limit
        throw new Error(`SQL parameter ${index} blob too large (${param.length} bytes) for ${methodName}`);
      }
    });

    return params;
  }

  /**
   * Validate embedding dimensions
   */
  static validateEmbeddingDimensions(dimensions: any, methodName: string): number {
    if (typeof dimensions !== 'number' || !Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error(`Invalid embedding dimensions for ${methodName}: must be a positive integer`);
    }

    if (dimensions > 4096) { // Reasonable upper limit
      throw new Error(`Embedding dimensions too large for ${methodName}: maximum 4096 dimensions supported`);
    }

    return dimensions;
  }

  /**
   * Validate search limit parameter
   */
  static validateLimit(limit: any, methodName: string, defaultValue: number = 10): number {
    if (limit === undefined) {
      return defaultValue;
    }

    if (!isValidLimit(limit)) {
      throw new Error(`Invalid limit for ${methodName}: must be a positive integer between 1 and 10000`);
    }

    return limit;
  }

  /**
   * Validate search threshold parameter
   */
  static validateThreshold(threshold: any, methodName: string): number | undefined {
    if (threshold === undefined) {
      return undefined;
    }

    if (!isValidThreshold(threshold)) {
      throw new Error(`Invalid threshold for ${methodName}: must be a number between 0 and 1`);
    }

    return threshold;
  }
}