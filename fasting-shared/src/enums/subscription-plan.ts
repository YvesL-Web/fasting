export const SUBSCRIPTION_PLANS = ["FREE", "PREMIUM_MONTHLY", "PREMIUM_YEARLY"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
