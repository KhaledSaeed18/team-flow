import type { z } from 'zod';

/**
 * Validate search params one key at a time: a bad value (a hand-edited link, an old bookmark) is dropped instead of
 * failing the whole page. Every key in these schemas is optional, so dropping one is always valid.
 */
export function lenient<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  return (search: Record<string, unknown>): z.infer<z.ZodObject<Shape>> => {
    // Every key is returned, invalid ones as `undefined`: the router keeps raw values for keys a validator leaves
    // out, so leaving a bad one out would let it through unchecked.
    const valid: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema.shape)) {
      const parsed = (field as z.ZodType).safeParse(search[key]);
      valid[key] = parsed.success ? parsed.data : undefined;
    }
    return valid as z.infer<z.ZodObject<Shape>>;
  };
}
