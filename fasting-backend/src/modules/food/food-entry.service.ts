import { Repository, Between } from 'typeorm'
import { startOfDay, endOfDay, formatDate, eachDayOfInterval, subDays } from 'date-fns'

import { FoodEntryEntity } from './food-entry.entity'
import { FastEntity } from '../fasts/fast.entity'
import { UserEntity } from '../users/user.entity'
import type {
  CreateFoodEntryInput,
  FoodDaySummary,
  FoodSummaryQuery,
  ListFoodEntriesQuery,
  foodSummaryQuerySchema
} from './food-entry.schemas'
import { fastingPresets } from '../fasts/fast.schemas'
import { AppError, ERR } from '../../utils/error'

export class FoodEntryService {
  constructor(
    private readonly foodRepo: Repository<FoodEntryEntity>,
    private readonly fastsRepo: Repository<FastEntity>,
    private readonly usersRepo: Repository<UserEntity>
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

    // On prend les fasts récents (par ex. sur les 7 derniers jours) pour limiter le volume
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const fasts = await this.fastsRepo.find({
      where: {
        user: { id: userId }
      },
      order: { startAt: 'DESC' }
    })

    let linkedFast: FastEntity | null = null
    let inEatingWindow = false

    for (const fast of fasts) {
      // on ignore les fasts trop anciens
      if (fast.startAt < since) break

      const window = this.computeEatingWindowForFast(fast)
      if (!window) continue

      const { eatingWindowStartAt, eatingWindowEndAt } = window
      const fastStart = fast.startAt

      const loggedMs = loggedAt.getTime()
      const startMs = fastStart.getTime()
      const eatStartMs = eatingWindowStartAt.getTime()
      const eatEndMs = eatingWindowEndAt.getTime()

      // On considère que ce fast est lié si loggedAt ∈ [startAt, eatingWindowEndAt]
      if (loggedMs >= startMs && loggedMs <= eatEndMs) {
        linkedFast = fast
        // inEatingWindow = true si entre eatingStart et eatingEnd
        inEatingWindow = loggedMs >= eatStartMs && loggedMs <= eatEndMs
        break
      }
    }

    const entry = this.foodRepo.create({
      user,
      fast: linkedFast,
      loggedAt,
      label: input.label,
      calories: input.calories ?? null,
      proteinGrams: input.proteinGrams ?? null,
      carbsGrams: input.carbsGrams ?? null,
      fatGrams: input.fatGrams ?? null,
      inEatingWindow
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
        // loggedAt: {
        //   $gte: from as any,
        //   $lte: to as any
        // } as any
      },
      order: { loggedAt: 'ASC' },
      relations: ['fast']
    })
  }

  async getSummary(
    userId: string,
    query: FoodSummaryQuery
  ): Promise<{ from: string; to: string; days: FoodDaySummary[] }> {
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
      order: { loggedAt: 'ASC' }
    })

    const map = new Map<string, FoodDaySummary>()

    for (const entry of entries) {
      const dayKey = formatDate(entry.loggedAt, 'yyyy-MM-dd')
      const cals = entry.calories ?? 0

      let rec = map.get(dayKey)
      if (!rec) {
        rec = {
          day: dayKey,
          totalCalories: 0,
          inWindowCalories: 0,
          outWindowCalories: 0,
          entriesCount: 0
        }
        map.set(dayKey, rec)
      }

      rec.totalCalories += cals
      if (entry.inEatingWindow) {
        rec.inWindowCalories += cals
      } else {
        rec.outWindowCalories += cals
      }
      rec.entriesCount += 1
    }

    const allDays = eachDayOfInterval({ start: from, end: to })
    const days: FoodDaySummary[] = allDays.map((d) => {
      const key = formatDate(d, 'yyyy-MM-dd')
      return (
        map.get(key) ?? {
          day: key,
          totalCalories: 0,
          inWindowCalories: 0,
          outWindowCalories: 0,
          entriesCount: 0
        }
      )
    })

    return {
      from: formatDate(from, 'yyyy-MM-dd'),
      to: formatDate(to, 'yyyy-MM-dd'),
      days
    }
  }
}
