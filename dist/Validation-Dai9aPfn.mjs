import { ValidationError as r } from "./Errors-CBeo1Lsn.mjs";
function s(t, i) {
  const a = [];
  if (!t.content && !t.title && a.push("Document must have at least 'content' or 'title' field"), t.metadata !== void 0 && (typeof t.metadata != "object" || t.metadata === null ? a.push("metadata must be a plain object (got " + typeof t.metadata + ")") : Array.isArray(t.metadata) && a.push("metadata must be a plain object, not an array"), t.metadata?.collection !== void 0 && a.push(
    "⚠️  NOTE: metadata.collection is no longer used internally (as of schema v3). This field will be stored as-is in your metadata. If you intended to set the collection, use the 'collection' parameter instead. This is a warning, not an error - your data will be stored correctly."
  )), t.id !== void 0) {
    const e = typeof t.id;
    e !== "string" && e !== "number" && a.push(`document.id must be a string or number (got ${e})`), e === "string" && t.id.toString().trim() === "" && a.push("document.id cannot be an empty string");
  }
  if (t.metadata)
    try {
      const e = JSON.stringify(t.metadata).length;
      e > 1048576 && a.push(
        `metadata size (${e} bytes) exceeds recommended limit of 1MB. Large metadata may impact performance.`
      );
    } catch {
      a.push(
        "metadata contains values that cannot be serialized to JSON (functions, undefined, circular references, etc.)"
      );
    }
  if (a.length > 0)
    throw new r(
      `Invalid document structure for collection '${i}':
` + a.map((e, n) => `  ${n + 1}. ${e}`).join(`
`),
      { collection: i, document: t, errors: a }
    );
}
function d(t) {
  return t.toString().trim();
}
function l() {
  const t = Date.now(), i = Math.random().toString(36).substr(2, 9);
  return `doc_${t}_${i}`;
}
export {
  l as generateDocumentId,
  d as sanitizeDocumentId,
  s as validateDocument
};
//# sourceMappingURL=Validation-Dai9aPfn.mjs.map
