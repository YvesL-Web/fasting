import { z } from "zod";
import { USER_ROLES } from "../enums/user-role";
import { SUBSCRIPTION_PLANS } from "../enums/subscription-plan";

export const userIdSchema = z.uuid();

export const userSchema = z.object({
  id: userIdSchema,
  email: z.email(),
  displayName: z.string().min(1).max(100),
  locale: z.enum(["en", "fr", "de"]).default("en"),
  role: z.enum(USER_ROLES).default("USER"),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).default("FREE"),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type User = z.infer<typeof userSchema>;
