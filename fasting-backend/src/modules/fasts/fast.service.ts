import { Repository, IsNull } from 'typeorm'
import { differenceInHours, isBefore, startOfDay, subDays } from 'date-fns'
import { FastEntity } from './fast.entity'
import type { StartFastInput, StopFastInput, ListFastsQuery, FastStats } from './fast.schemas'
import { UserEntity } from '../users/user.entity'
import { AppError, ERR } from '../../utils/error'

export class FastService {
  constructor(
    private readonly fastsRepo: Repository<FastEntity>,
    private readonly usersRepo: Repository<UserEntity>
  ) {}

  async getCurrentFast(userId: string): Promise<FastEntity | null> {
    return this.fastsRepo.findOne({
      where: { user: { id: userId }, endAt: IsNull() }
    })
  }

  async startFast(userId: string, input: StartFastInput): Promise<FastEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'User not found.' },
        { reason: 'USER_NOT_FOUND', userId }
      )
    }

    const existing = await this.getCurrentFast(userId)
    if (existing) {
      throw new AppError(
        { ...ERR.CONFLICT, message: 'Fast already running' },
        { reason: 'FAST_ALREADY_RUNNING' }
      )
    }

    const fast = this.fastsRepo.create({
      user,
      type: input.type,
      startAt: input.startAt ?? new Date(),
      endAt: null,
      notes: input.notes ?? null
    })

    return this.fastsRepo.save(fast)
  }

  async stopFast(userId: string, input: StopFastInput): Promise<FastEntity> {
    const current = await this.getCurrentFast(userId)
    if (!current) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'No active fast' },
        { reason: 'NO_ACTIVE_FAST' }
      )
    }

    const endAt = input.endAt ?? new Date()

    if (isBefore(endAt, current.startAt)) {
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: 'End date is before start date' },
        { reason: 'END_DATE_BEFORE_START_DATE', startAt: current.startAt, endAt }
      )
    }

    current.endAt = endAt
    if (input.notes) {
      current.notes = input.notes
    }

    return this.fastsRepo.save(current)
  }

  async listFasts(userId: string, query: ListFastsQuery): Promise<FastEntity[]> {
    const { limit, offset } = query

    return this.fastsRepo.find({
      where: { user: { id: userId } },
      order: { startAt: 'DESC' },
      take: limit,
      skip: offset
    })
  }

  async getStats(userId: string): Promise<FastStats> {
    // On récupère tous les fasts (finis + en cours) pour stats
    const allFasts = await this.fastsRepo.find({
      where: { user: { id: userId } },
      order: { startAt: 'ASC' }
    })

    if (allFasts.length === 0) {
      return {
        totalFasts: 0,
        totalHours: 0,
        averageHours: 0,
        longestFastHours: 0,
        currentStreakDays: 0
      }
    }

    let totalHours = 0
    let longest = 0

    const completedFasts = allFasts.filter((f) => f.endAt !== null)

    for (const f of completedFasts) {
      const end = f.endAt ?? new Date()
      const hours = differenceInHours(end, f.startAt)
      totalHours += Math.max(hours, 0)
      if (hours > longest) longest = hours
    }

    const averageHours = completedFasts.length > 0 ? totalHours / completedFasts.length : 0

    // streak : nombre de jours consécutifs où il y a eu au moins un fast
    const today = startOfDay(new Date())
    let streak = 0
    let cursor = today

    while (true) {
      const hasFastThatDay = allFasts.some((f) => {
        const startDay = startOfDay(f.startAt)
        return startDay.getTime() === cursor.getTime()
      })

      if (!hasFastThatDay) break

      streak += 1
      cursor = subDays(cursor, 1)
    }

    return {
      totalFasts: completedFasts.length,
      totalHours,
      averageHours,
      longestFastHours: longest,
      currentStreakDays: streak
    }
  }
}
