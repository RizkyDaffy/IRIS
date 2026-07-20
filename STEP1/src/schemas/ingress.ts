import { z } from 'zod';

// §0.4 — exact wire shapes, shared with SDK
export const RouteSchemaItem = z.object({
  path: z.string().min(1),
  method: z.string().min(1),
  description: z.string().optional(),
  schema: z.record(z.unknown()).optional(),
});

export const RegisterPayload = z.array(RouteSchemaItem);

export const PublishPayload = z.object({
  event: z.string().min(1),
  data: z.unknown(),
  idempotencyKey: z.string().optional(),
});

export type RouteSchemaItem = z.infer<typeof RouteSchemaItem>;
export type RegisterPayload = z.infer<typeof RegisterPayload>;
export type PublishPayload = z.infer<typeof PublishPayload>;
