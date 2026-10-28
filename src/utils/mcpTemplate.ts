import { record } from '../types/contracts';

/** Draft required arguments from the server schema; empty strings require real values. */
function draft(value: unknown, depth = 0): unknown {
  const schema = record(value);
  if (depth > 12) return null;
  if ('default' in schema) return schema['default'];
  if ('const' in schema) return schema['const'];
  if (Array.isArray(schema['enum'])) return schema['enum'][0] ?? null;
  const variants = schema['anyOf'] ?? schema['oneOf'];
  if (Array.isArray(variants) && variants.length) return draft(variants[0], depth + 1);
  switch (schema['type']) {
    case 'object': {
      const properties = record(schema['properties']);
      const required = Array.isArray(schema['required']) ? schema['required'] : [];
      return Object.fromEntries(required.filter((key): key is string => typeof key === 'string' && key !== 'projectId')
        .map((key) => [key, draft(properties[key], depth + 1)]));
    }
    case 'array': {
      const count = typeof schema['minItems'] === 'number' ? Math.min(10, Math.max(0, schema['minItems'])) : 0;
      return Array.from({ length: count }, () => draft(schema['items'], depth + 1));
    }
    case 'number':
    case 'integer': return schema['minimum'] ?? 0;
    case 'boolean': return false;
    case 'null': return null;
    default: return '';
  }
}
export function mcpTemplate(schema: Record<string, unknown>): string {
  return JSON.stringify(draft(schema), null, 2);
}
