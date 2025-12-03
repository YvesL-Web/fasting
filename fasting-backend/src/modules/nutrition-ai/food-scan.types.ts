export type FoodScanSuggestion = {
  label: string
  calories?: number | null
  proteinGrams?: number | null
  carbsGrams?: number | null
  fatGrams?: number | null
  confidence: number // 0..1
}

export type FoodScanResult = {
  suggestions: FoodScanSuggestion[]
  // À activer pour la création automatique de FoodItem
  createdItemIds?: string[]
}
