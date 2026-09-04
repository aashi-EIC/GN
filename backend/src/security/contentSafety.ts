import { UnsafeContentError } from "../errors.js";

const unsafe = [
  /<\s*script\b/i,
  /<\s*(?:iframe|object|embed|applet|meta|base)\b/i,
  /\bon\w+\s*=/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<\s*link\b[^>]*\brel\s*=\s*["']?import/i,
];

export function assertSafeText(value: string, label: string) {
  if (unsafe.some((pattern) => pattern.test(value)))
    throw new UnsafeContentError(`${label} contains prohibited active content`);
}

export function assertSafeUnknown(value: unknown, label = "MCP response", depth = 0): void {
  if (depth > 30) throw new UnsafeContentError(`${label} exceeds the maximum nesting depth`);
  if (typeof value === "string") return assertSafeText(value, label);
  if (Array.isArray(value))
    return value.forEach((item) => assertSafeUnknown(item, label, depth + 1));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      assertSafeText(key, label);
      assertSafeUnknown(obj[key], label, depth + 1);
    }
  }
}
