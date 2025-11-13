export const USER_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];
