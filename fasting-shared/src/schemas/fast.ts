import { z } from "zod";
import { FAST_TYPES } from "../enums/fast-type";
import { userIdSchema } from "./user";

export const fastIdSchema = z.uuid();

export const fastSchema = z.object({
  id: fastIdSchema,
  userId: userIdSchema,
  type: z.enum(FAST_TYPES),
  startAt: z.date(),
  endAt: z.date().nullable(), // null si en cours
  notes: z.string().max(500).optional()
});

export type Fast = z.infer<typeof fastSchema>;
