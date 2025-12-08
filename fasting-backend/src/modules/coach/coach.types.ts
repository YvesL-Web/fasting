import type { FoodDaySummary, FoodTopRecipeSummary } from '../food/schemas/food-entry.schemas'

export type FastSummaryForCoach = {
  type: string
  startedAt: string
  endedAt: string | null
  targetHours: number | null
  actualHours: number | null
  eatingHours: number | null
}

export type FoodSummaryForCoach = {
  from: string
  to: string
  days: FoodDaySummary[]
  topRecipes: FoodTopRecipeSummary[]
}

export type FastCoachInput = {
  locale: 'en' | 'fr' | 'de'
  fast: FastSummaryForCoach | null
  foodSummary: FoodSummaryForCoach | null
  mood?: string
  notes?: string
  mainGoal?: 'weight_loss' | 'energy' | 'health' | 'maintenance'
}
