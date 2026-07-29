const SENSITIVE_KEYS = /token|secret|password|authorization|cookie|email|image|svg|document|payload|raw|access|refresh/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[TRUNCATED]";
  if (typeof value === "string") return value.length > 160 ? `[STRING:${value.length}]` : value;
  if (Array.isArray(value)) return `[ARRAY:${value.length}]`;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redact(item, depth + 1)]));
}

export const secureLogger = {
  info(message: string, metadata?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") console.info(message, redact(metadata));
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    console.warn(message, redact(metadata));
  },
  error(message: string, metadata?: Record<string, unknown>) {
    console.error(message, redact(metadata));
  },
};
