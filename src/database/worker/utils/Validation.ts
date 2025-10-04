/**
 * Document Validation Functions
 *
 * Validates document structure before insertion to prevent silent failures.
 */

import { ValidationError } from './Errors.js';

/**
 * Document structure for validation
 */
export interface DocumentToValidate {
  id?: string | number;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
}

/**
 * Validate document structure before insertion
 *
 * Checks:
 * - Required fields (content OR title must exist)
 * - Metadata structure (must be plain object if provided)
 * - Reserved field warnings (metadata.collection)
 * - ID type validation (string or number if provided)
 *
 * @param document - Document to validate
 * @param collection - Target collection name
 * @throws ValidationError with detailed context if validation fails
 */
export function validateDocument(
  document: DocumentToValidate,
  collection: string
): void {
  const errors: string[] = [];

  // REQ-3.1: Check required fields
  if (!document.content && !document.title) {
    errors.push("Document must have at least 'content' or 'title' field");
  }

  // REQ-3.2: Check metadata structure
  if (document.metadata !== undefined) {
    if (typeof document.metadata !== 'object' || document.metadata === null) {
      errors.push("metadata must be a plain object (got " + typeof document.metadata + ")");
    } else if (Array.isArray(document.metadata)) {
      errors.push("metadata must be a plain object, not an array");
    }

    // REQ-3.3: Check for reserved metadata fields (WARNING, not error)
    // As of schema v3, metadata.collection is no longer used internally,
    // but we warn users who may be upgrading from v2
    if (document.metadata?.collection !== undefined) {
      errors.push(
        "⚠️  NOTE: metadata.collection is no longer used internally (as of schema v3). " +
        "This field will be stored as-is in your metadata. " +
        "If you intended to set the collection, use the 'collection' parameter instead. " +
        "This is a warning, not an error - your data will be stored correctly."
      );
    }
  }

  // REQ-3.4: Validate ID if provided
  if (document.id !== undefined) {
    const idType = typeof document.id;
    if (idType !== 'string' && idType !== 'number') {
      errors.push(`document.id must be a string or number (got ${idType})`);
    }

    // Check for empty string IDs
    if (idType === 'string' && document.id.toString().trim() === '') {
      errors.push("document.id cannot be an empty string");
    }
  }

  // Additional validation: Check for extremely large metadata
  if (document.metadata) {
    try {
      const metadataSize = JSON.stringify(document.metadata).length;
      if (metadataSize > 1048576) { // 1MB
        errors.push(
          `metadata size (${metadataSize} bytes) exceeds recommended limit of 1MB. ` +
          "Large metadata may impact performance."
        );
      }
    } catch (error) {
      errors.push(
        "metadata contains values that cannot be serialized to JSON " +
        "(functions, undefined, circular references, etc.)"
      );
    }
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid document structure for collection '${collection}':\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
      { collection, document, errors }
    );
  }
}

/**
 * Validate collection name
 *
 * @param collection - Collection name to validate
 * @throws ValidationError if collection name is invalid
 */
export function validateCollectionName(collection: string): void {
  const errors: string[] = [];

  if (typeof collection !== 'string') {
    errors.push(`collection must be a string (got ${typeof collection})`);
  } else if (collection.trim() === '') {
    errors.push("collection name cannot be empty");
  } else if (collection.length > 64) {
    errors.push(`collection name too long (max 64 characters, got ${collection.length})`);
  } else if (!/^[a-zA-Z0-9_-]+$/.test(collection)) {
    errors.push(
      "collection name must contain only alphanumeric characters, hyphens, and underscores"
    );
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid collection name '${collection}':\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
      { collection, document: {}, errors }
    );
  }
}

/**
 * Sanitize document ID
 *
 * Converts ID to string and ensures it's valid.
 *
 * @param id - Document ID to sanitize
 * @returns Sanitized ID as string
 */
export function sanitizeDocumentId(id: string | number): string {
  return id.toString().trim();
}

/**
 * Generate unique document ID
 *
 * Generates a unique ID for documents that don't provide one.
 *
 * @returns Unique document ID
 */
export function generateDocumentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `doc_${timestamp}_${random}`;
}
