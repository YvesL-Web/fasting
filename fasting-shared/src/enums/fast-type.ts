export const FAST_TYPES = ["12_12", "14_10", "16_8", "18_6", "20_4", "OMAD"] as const;

export type FastType = (typeof FAST_TYPES)[number];
