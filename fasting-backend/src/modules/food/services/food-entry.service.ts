import { Repository, Between, MoreThanOrEqual } from 'typeorm'
import { startOfDay, endOfDay, format, eachDayOfInterval, subDays, formatDate } from 'date-fns'

import { FoodEntryEntity } from '../entities/food-entry.entity'
import { FastEntity } from '../../fasts/fast.entity'
import { UserEntity } from '../../users/user.entity'
import type {
  CreateFoodEntryInput,
  FoodDaySummary,
  FoodSummaryQuery,
  FoodTopRecipeSummary,
  ListFoodEntriesQuery,
  UpdateFoodEntryInput
} from '../schemas/food-entry.schemas'
import { fastingPresets } from '../../fasts/fast.schemas'
import { AppError, ERR } from '../../../utils/error'
import { RecipeEntity } from '../../recipes/recipe.entity'
import { FoodItemEntity } from '../entities/food-item.entity'

export class FoodEntryService {
  constructor(
    private readonly foodRepo: Repository<FoodEntryEntity>,
    private readonly fastsRepo: Repository<FastEntity>,
    private readonly usersRepo: Repository<UserEntity>,
    private readonly recipesRepo: Repository<RecipeEntity>,
    private readonly foodItemsRepo: Repository<FoodItemEntity>
  ) {}

  private computeEatingWindowForFast(fast: FastEntity) {
    const preset = fastingPresets.find((p) => p.id === fast.type)
    if (!preset) return null

    const fastingHours = fast.targetDurationHours ?? preset.fastingHours
    if (!fastingHours || fastingHours <= 0) return null

    const startMs = fast.startAt.getTime()
    const fastingMs = fastingHours * 60 * 60 * 1000
    const fastTargetEndAt = new Date(startMs + fastingMs)

    const eatingMs = preset.eatingHours * 60 * 60 * 1000
    const eatingWindowStartAt = fastTargetEndAt
    const eatingWindowEndAt = new Date(fastTargetEndAt.getTime() + eatingMs)

    return { fastTargetEndAt, eatingWindowStartAt, eatingWindowEndAt }
  }

  private async resolveFastForLoggedAt(userId: string, loggedAt: Date) {
    // perf: limiter aux fasts récents (7j)
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const fasts = await this.fastsRepo.find({
      where: { user: { id: userId } },
      order: { startAt: 'DESC' }
    })

    let linkedFast: FastEntity | null = null
    let inEatingWindow = false

    for (const fast of fasts) {
      if (fast.startAt < since) break

      const window = this.computeEatingWindowForFast(fast)
      if (!window) continue

      const loggedMs = loggedAt.getTime()
      const startMs = fast.startAt.getTime()
      const eatStartMs = window.eatingWindowStartAt.getTime()
      const eatEndMs = window.eatingWindowEndAt.getTime()

      if (loggedMs >= startMs && loggedMs <= eatEndMs) {
        linkedFast = fast
        inEatingWindow = loggedMs >= eatStartMs && loggedMs <= eatEndMs
        break
      }
    }

    return { linkedFast, inEatingWindow }
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) throw new AppError(ERR.NOT_FOUND, 'User not found')
    return user
  }

  private async resolveRecipeForUser(userId: string, recipeId: string): Promise<RecipeEntity> {
    const recipe = await this.recipesRepo.findOne({
      where: { id: recipeId },
      relations: ['author']
    })
    if (!recipe) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Recipe not found.' },
        { reason: 'RECIPE_NOT_FOUND', recipeId }
      )
    }
    const canView = recipe.isPublic || recipe.author?.id === userId
    if (!canView) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'You cannot use this recipe.' },
        { reason: 'RECIPE_PRIVATE', recipeId }
      )
    }
    return recipe
  }

  private async resolveFoodItemForUser(
    userId: string,
    foodItemId: string
  ): Promise<FoodItemEntity> {
    const item = await this.foodItemsRepo.findOne({
      where: { id: foodItemId },
      relations: ['owner']
    })
    if (!item) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Food item not found.' },
        { reason: 'FOOD_ITEM_NOT_FOUND', foodItemId }
      )
    }

    // règle: GLOBAL ok, USER seulement si owner = userId
    const ok = item.source === 'GLOBAL' || item.owner?.id === userId
    if (!ok) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'You cannot use this food item.' },
        { reason: 'FOOD_ITEM_FORBIDDEN', foodItemId }
      )
    }
    return item
  }

  async createEntry(userId: string, input: CreateFoodEntryInput): Promise<FoodEntryEntity> {
    const user = await this.getUserOrThrow(userId)

    if (input.recipeId && input.foodItemId) {
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: 'Provide either recipeId or foodItemId, not both.' },
        { reason: 'AMBIGUOUS_SOURCE' }
      )
    }

    const loggedAt = input.loggedAt ?? new Date()
    const { linkedFast, inEatingWindow } = await this.resolveFastForLoggedAt(userId, loggedAt)

    const recipe = input.recipeId ? await this.resolveRecipeForUser(userId, input.recipeId) : null
    const foodItem = input.foodItemId
      ? await this.resolveFoodItemForUser(userId, input.foodItemId)
      : null

    const entry = this.foodRepo.create({
      user,
      fast: linkedFast,
      loggedAt,
      label: input.label,

      calories: input.calories ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbsGrams: input.carbsGrams ?? null,
      fatGrams: input.fatGrams ?? null,

      inEatingWindow,
      isPostFast: input.isPostFast ?? false,

      recipe,
      foodItem
    })

    return this.foodRepo.save(entry)
  }

  async listEntries(userId: string, query: ListFoodEntriesQuery): Promise<FoodEntryEntity[]> {
    const day = query.day ? new Date(query.day + 'T00:00:00') : new Date()
    const from = startOfDay(day)
    const to = endOfDay(day)

    return this.foodRepo.find({
      where: {
        user: { id: userId },
        loggedAt: Between(from, to)
      },
      order: { loggedAt: 'ASC' },
      relations: ['fast', 'recipe', 'foodItem']
    })
  }

  // async getSummary(
  //   userId: string,
  //   query: FoodSummaryQuery
  // ): Promise<{
  //   from: string
  //   to: string
  //   days: FoodDaySummary[]
  //   topRecipes: FoodTopRecipeSummary[]
  // }> {
  //   const today = new Date()

  //   const fromDate = query.from ? new Date(query.from + 'T00:00:00') : subDays(today, 6)
  //   const toDate = query.to ? new Date(query.to + 'T00:00:00') : today

  //   const from = startOfDay(fromDate)
  //   const to = endOfDay(toDate)

  //   const entries = await this.foodRepo.find({
  //     where: {
  //       user: { id: userId },
  //       loggedAt: Between(from, to)
  //     },
  //     order: { loggedAt: 'ASC' },
  //     relations: ['recipe']
  //   })

  //   const dayMap = new Map<string, FoodDaySummary>()
  //   const recipeMap = new Map<string, FoodTopRecipeSummary>()

  //   for (const entry of entries) {
  //     const dayKey = formatDate(entry.loggedAt, 'yyyy-MM-dd')
  //     const cals = entry.calories ?? 0

  //     let rec = dayMap.get(dayKey)
  //     if (!rec) {
  //       rec = {
  //         day: dayKey,
  //         totalCalories: 0,
  //         inWindowCalories: 0,
  //         outWindowCalories: 0,
  //         entriesCount: 0,
  //         postFastCalories: 0
  //       }
  //       dayMap.set(dayKey, rec)
  //     }

  //     rec.totalCalories += cals
  //     if (entry.inEatingWindow) {
  //       rec.inWindowCalories += cals
  //     } else {
  //       rec.outWindowCalories += cals
  //     }
  //     if (entry.isPostFast) {
  //       rec.postFastCalories += cals
  //     }
  //     rec.entriesCount += 1

  //     // Top recettes
  //     if (entry.recipe) {
  //       const id = entry.recipe.id
  //       let r = recipeMap.get(id)
  //       if (!r) {
  //         r = {
  //           recipeId: id,
  //           title: entry.recipe.title,
  //           imageUrl: entry.recipe.imageUrl ?? null,
  //           uses: 0,
  //           totalCalories: 0
  //         }
  //         recipeMap.set(id, r)
  //       }
  //       r.uses += 1
  //       r.totalCalories += cals
  //     }
  //   }

  //   const allDays = eachDayOfInterval({ start: from, end: to })
  //   const days: FoodDaySummary[] = allDays.map((d) => {
  //     const key = formatDate(d, 'yyyy-MM-dd')
  //     return (
  //       dayMap.get(key) ?? {
  //         day: key,
  //         totalCalories: 0,
  //         inWindowCalories: 0,
  //         outWindowCalories: 0,
  //         entriesCount: 0,
  //         postFastCalories: 0
  //       }
  //     )
  //   })

  //   // On trie les recettes par nombre d'utilisations puis par calories
  //   const topRecipes = Array.from(recipeMap.values())
  //     .sort((a, b) => {
  //       if (b.uses !== a.uses) return b.uses - a.uses
  //       return b.totalCalories - a.totalCalories
  //     })
  //     .slice(0, 5) // Top 5 sur la période

  //   return {
  //     from: formatDate(from, 'yyyy-MM-dd'),
  //     to: formatDate(to, 'yyyy-MM-dd'),
  //     days,
  //     topRecipes
  //   }
  // }

  async getSummary(
    userId: string,
    query: FoodSummaryQuery
  ): Promise<{
    from: string
    to: string
    days: FoodDaySummary[]
    topRecipes: FoodTopRecipeSummary[]
  }> {
    const today = new Date()

    const fromDate = query.from ? new Date(query.from + 'T00:00:00') : subDays(today, 6)
    const toDate = query.to ? new Date(query.to + 'T00:00:00') : today

    const from = startOfDay(fromDate)
    const to = endOfDay(toDate)

    // ✅ IMPORTANT: relation recipe pour topRecipes
    const entries = await this.foodRepo.find({
      where: { user: { id: userId }, loggedAt: Between(from, to) },
      order: { loggedAt: 'ASC' },
      relations: ['recipe']
    })

    // ---- Days aggregation
    const dayMap = new Map<string, FoodDaySummary>()

    for (const entry of entries) {
      const dayKey = formatDate(entry.loggedAt, 'yyyy-MM-dd')
      const cals = entry.calories ?? 0

      let rec = dayMap.get(dayKey)
      if (!rec) {
        rec = {
          day: dayKey,
          totalCalories: 0,
          inWindowCalories: 0,
          outWindowCalories: 0,
          entriesCount: 0,
          postFastCalories: 0
        }
        dayMap.set(dayKey, rec)
      }

      rec.totalCalories += cals
      rec.entriesCount += 1

      if (entry.inEatingWindow) rec.inWindowCalories += cals
      else rec.outWindowCalories += cals

      if (entry.isPostFast) rec.postFastCalories += cals
    }

    const days: FoodDaySummary[] = eachDayOfInterval({ start: from, end: to }).map((d) => {
      const key = formatDate(d, 'yyyy-MM-dd')
      return (
        dayMap.get(key) ?? {
          day: key,
          totalCalories: 0,
          inWindowCalories: 0,
          outWindowCalories: 0,
          entriesCount: 0,
          postFastCalories: 0
        }
      )
    })

    // ---- Top recipes aggregation
    const recipeMap = new Map<
      string,
      {
        recipeId: string
        title: string
        imageUrl: string | null
        uses: number
        totalCalories: number
      }
    >()

    for (const e of entries) {
      if (!e.recipe) continue

      const id = e.recipe.id
      const rec = recipeMap.get(id) ?? {
        recipeId: id,
        title: e.recipe.title,
        imageUrl: e.recipe.imageUrl ?? null,
        uses: 0,
        totalCalories: 0
      }

      rec.uses += 1
      rec.totalCalories += e.calories ?? 0

      // garde la dernière image/titre au cas où
      rec.title = e.recipe.title
      rec.imageUrl = e.recipe.imageUrl ?? rec.imageUrl

      recipeMap.set(id, rec)
    }

    const topRecipes = Array.from(recipeMap.values())
      .sort((a, b) => b.uses - a.uses || b.totalCalories - a.totalCalories)
      .slice(0, 10)

    return {
      from: formatDate(from, 'yyyy-MM-dd'),
      to: formatDate(to, 'yyyy-MM-dd'),
      days,
      topRecipes
    }
  }

  async updateEntry(
    userId: string,
    entryId: string,
    input: UpdateFoodEntryInput
  ): Promise<FoodEntryEntity> {
    const entry = await this.foodRepo.findOne({
      where: { id: entryId },
      relations: ['user', 'recipe', 'foodItem', 'fast']
    })

    if (!entry) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Food entry not found.' },
        { reason: 'ENTRY_NOT_FOUND', entryId }
      )
    }
    if (entry.user.id !== userId) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'Not allowed.' },
        { reason: 'NOT_OWNER', entryId }
      )
    }

    // si l’API reçoit recipeId/foodItemId dans le même PATCH => interdit
    if (input.recipeId !== undefined && input.foodItemId !== undefined) {
      if (input.recipeId && input.foodItemId) {
        throw new AppError(
          { ...ERR.BAD_REQUEST, message: 'Provide either recipeId or foodItemId, not both.' },
          { reason: 'AMBIGUOUS_SOURCE' }
        )
      }
    }

    // 1) champs simples
    if (input.label !== undefined) entry.label = input.label

    if (input.calories !== undefined) entry.calories = input.calories ?? null
    if (input.proteinGrams !== undefined) entry.proteinGrams = input.proteinGrams ?? null
    if (input.carbsGrams !== undefined) entry.carbsGrams = input.carbsGrams ?? null
    if (input.fatGrams !== undefined) entry.fatGrams = input.fatGrams ?? null

    if (input.isPostFast !== undefined) entry.isPostFast = input.isPostFast

    // 2) changer loggedAt => recalc fast + inEatingWindow
    if (input.loggedAt !== undefined) {
      entry.loggedAt = input.loggedAt
      const { linkedFast, inEatingWindow } = await this.resolveFastForLoggedAt(
        userId,
        input.loggedAt
      )
      entry.fast = linkedFast
      entry.inEatingWindow = inEatingWindow
    }

    // 3) liens recipe / foodItem
    if (input.recipeId !== undefined) {
      if (input.recipeId === null) {
        entry.recipe = null
      } else {
        const recipe = await this.resolveRecipeForUser(userId, input.recipeId)
        entry.recipe = recipe
        // si on set une recipe, on peut décider de clear foodItem
        entry.foodItem = null
      }
    }

    if (input.foodItemId !== undefined) {
      if (input.foodItemId === null) {
        entry.foodItem = null
      } else {
        const item = await this.resolveFoodItemForUser(userId, input.foodItemId)
        entry.foodItem = item
        entry.recipe = null
      }
    }

    // 4) si recipeId et foodItemId non envoyés mais macros envoyées, ok
    // 5) si l’entrée n’a plus de fast (car loggedAt changé), inEatingWindow reste false
    if (!entry.fast) {
      entry.inEatingWindow = false
    }

    return this.foodRepo.save(entry)
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.foodRepo.findOne({
      where: { id: entryId },
      relations: ['user']
    })
    if (!entry) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Food entry not found.' },
        { reason: 'ENTRY_NOT_FOUND', entryId }
      )
    }
    if (entry.user.id !== userId) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'Not allowed.' },
        { reason: 'NOT_OWNER', entryId }
      )
    }
    await this.foodRepo.remove(entry)
  }
}
