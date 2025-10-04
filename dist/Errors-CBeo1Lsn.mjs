class e extends Error {
  constructor(t, r) {
    super(t), this.context = r, this.name = "ValidationError", Error.captureStackTrace && Error.captureStackTrace(this, e);
  }
  /**
   * Format error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}
class s extends Error {
  constructor(t, r) {
    super(t), this.context = r, this.name = "DocumentInsertError", Error.captureStackTrace && Error.captureStackTrace(this, s);
  }
  /**
   * Format error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: {
        ...this.context,
        originalError: this.context.originalError?.message
      },
      stack: this.stack
    };
  }
}
export {
  s as DocumentInsertError,
  e as ValidationError
};
//# sourceMappingURL=Errors-CBeo1Lsn.mjs.map
