import { z } from "zod";
import { userIdSchema } from "./user"

export const mealIdSchema = z.uuid();

export const mealSchema = z.object({
  id: mealIdSchema,
  userId: userIdSchema,
  loggedAt: z.date(),
  calories: z.number().int().nonnegative(),
  description: z.string().max(500).optional()
  // future: macros, photoUrl, barcode, etc.
});

export type Meal = z.infer<typeof mealSchema>
