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
  ListFoodEntriesQuery
} from '../schemas/food-entry.schemas'
import { fastingPresets } from '../../fasts/fast.schemas'
import { AppError, ERR } from '../../../utils/error'
import { RecipeEntity } from '../../recipes/recipe.entity'

export class FoodEntryService {
  constructor(
    private readonly foodRepo: Repository<FoodEntryEntity>,
    private readonly fastsRepo: Repository<FastEntity>,
    private readonly usersRepo: Repository<UserEntity>,
    private readonly recipesRepo: Repository<RecipeEntity>
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

  async createEntry(userId: string, input: CreateFoodEntryInput): Promise<FoodEntryEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new AppError(ERR.NOT_FOUND, 'User not found')
    }

    const loggedAt = input.loggedAt ?? new Date()

    // Recette liée (optionnelle)
    let linkedRecipe: RecipeEntity | null = null
    if (input.recipeId) {
      const recipe = await this.recipesRepo.findOne({
        where: { id: input.recipeId },
        relations: ['author']
      })
      if (!recipe) {
        throw new AppError(
          { ...ERR.NOT_FOUND, message: 'Recipe not found.' },
          { reason: 'RECIPE_NOT_FOUND', recipeId: input.recipeId }
        )
      }

      const isOwner = recipe.author.id === userId
      if (!recipe.isPublic && !isOwner) {
        throw new AppError(
          { ...ERR.FORBIDDEN, message: 'You are not allowed to use this recipe.' },
          { reason: 'RECIPE_PRIVATE' }
        )
      }

      linkedRecipe = recipe
    }

    // Fasts récents
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const fasts = await this.fastsRepo.find({
      where: { user: { id: userId } },
      order: { startAt: 'DESC' }
    })

    let linkedFast: FastEntity | null = null
    let inEatingWindow = false
    let isPostFast = false

    const loggedMs = loggedAt.getTime()

    for (const fast of fasts) {
      if (fast.startAt < since) break

      const window = this.computeEatingWindowForFast(fast)
      if (!window) continue

      const { fastTargetEndAt, eatingWindowStartAt, eatingWindowEndAt } = window

      const startMs = fast.startAt.getTime()
      const fastEndMs = fastTargetEndAt.getTime()
      const eatStartMs = eatingWindowStartAt.getTime()
      const eatEndMs = eatingWindowEndAt.getTime()

      // on associe si [startAt, eatingWindowEndAt]
      if (loggedMs >= startMs && loggedMs <= eatEndMs) {
        linkedFast = fast

        inEatingWindow = loggedMs >= eatStartMs && loggedMs <= eatEndMs

        // "post-fast" : première portion de la fenêtre d'alimentation, ou plus simple :
        // tout ce qui est dans la fenêtre d'alim ET après la fin théorique du jeûne
        if (loggedMs >= fastEndMs && loggedMs <= eatEndMs) {
          isPostFast = true
        }

        break
      }
    }

    const entry = this.foodRepo.create({
      user,
      fast: linkedFast,
      recipe: linkedRecipe,
      loggedAt,
      label: input.label,
      calories: input.calories ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbsGrams: input.carbsGrams ?? null,
      fatGrams: input.fatGrams ?? null,
      inEatingWindow,
      isPostFast
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
      relations: ['fast', 'recipe']
    })
  }

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

    const entries = await this.foodRepo.find({
      where: {
        user: { id: userId },
        loggedAt: Between(from, to)
      },
      order: { loggedAt: 'ASC' },
      relations: ['recipe'] // 👈 pour pouvoir calculer top recettes
    })

    const dayMap = new Map<string, FoodDaySummary>()
    const recipeMap = new Map<string, FoodTopRecipeSummary>()

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
      if (entry.inEatingWindow) {
        rec.inWindowCalories += cals
      } else {
        rec.outWindowCalories += cals
      }
      if (entry.isPostFast) {
        rec.postFastCalories += cals
      }
      rec.entriesCount += 1

      // Top recettes
      if (entry.recipe) {
        const id = entry.recipe.id
        let r = recipeMap.get(id)
        if (!r) {
          r = {
            recipeId: id,
            title: entry.recipe.title,
            imageUrl: entry.recipe.imageUrl ?? null,
            uses: 0,
            totalCalories: 0
          }
          recipeMap.set(id, r)
        }
        r.uses += 1
        r.totalCalories += cals
      }
    }

    const allDays = eachDayOfInterval({ start: from, end: to })
    const days: FoodDaySummary[] = allDays.map((d) => {
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

    // On trie les recettes par nombre d'utilisations puis par calories
    const topRecipes = Array.from(recipeMap.values())
      .sort((a, b) => {
        if (b.uses !== a.uses) return b.uses - a.uses
        return b.totalCalories - a.totalCalories
      })
      .slice(0, 5) // Top 5 sur la période

    return {
      from: formatDate(from, 'yyyy-MM-dd'),
      to: formatDate(to, 'yyyy-MM-dd'),
      days,
      topRecipes
    }
  }
}
