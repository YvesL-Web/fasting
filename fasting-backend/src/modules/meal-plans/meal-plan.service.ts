// src/modules/meal-plans/meal-plan.service.ts
import OpenAI from 'openai'
import { Repository } from 'typeorm'

import { env } from '../../config/env'
import { UserEntity } from '../users/user.entity'
import {
  mealPlanGenerationInputSchema,
  type MealPlanGenerationInput,
  mealPlanSchema,
  type MealPlan
} from './meal-plan.schemas'
import { AppError, ERR } from '../../utils/error'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
})

export class MealPlanService {
  constructor(private readonly usersRepo: Repository<UserEntity>) {}

  async generate(userId: string, rawInput: MealPlanGenerationInput): Promise<MealPlan> {
    const user = await this.usersRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new AppError(
        { ...ERR.UNAUTHORIZED, message: 'User not found.' },
        { reason: 'USER_NOT_FOUND', userId }
      )
    }

    const input = mealPlanGenerationInputSchema.parse(rawInput)

    const locale = input.locale ?? user.locale ?? 'en'

    const systemPrompt =
      'You are a nutrition and intermittent fasting assistant. ' +
      'You generate concise, realistic meal plans for 1 to 7 days. ' +
      'Each day has a few meals (breakfast, lunch, dinner, snacks) ' +
      'with approximate calories and macros, plus a short description. ' +
      'Respect the daily calories target if provided and align with the goal (weight loss, maintenance, muscle gain). ' +
      'Prefer whole, minimally processed foods. ' +
      'Return only valid JSON, no commentary.'

    const userPrompt = [
      `Language: ${locale}`,
      `Days: ${input.days}`,
      input.dailyCaloriesTarget
        ? `Daily calories target: ~${input.dailyCaloriesTarget} kcal`
        : 'No strict calories target; keep meals balanced and light for fasting.',
      `Goal: ${input.goal}`,
      `Diet style: ${input.dietStyle}`,
      input.intolerances && input.intolerances.length > 0
        ? `Intolerances / avoid: ${input.intolerances.join(', ')}`
        : 'No specific intolerances stated.',
      '',
      'Structure the JSON as:',
      JSON.stringify(
        {
          goal: 'WEIGHT_LOSS',
          dailyCaloriesTarget: 1800,
          coachNotes: 'Short text advice for the user about this plan.',
          days: [
            {
              dayIndex: 1,
              label: 'Day 1',
              totalCalories: 1800,
              meals: [
                {
                  mealType: 'BREAKFAST',
                  title: '...',
                  description: '...',
                  calories: 450,
                  proteinGrams: 25,
                  carbsGrams: 40,
                  fatGrams: 15,
                  ingredients: ['...', '...'],
                  steps: ['...', '...'],
                  notes: '...'
                }
              ]
            }
          ]
        },
        null,
        2
      )
    ].join('\n')

    let text: string | undefined

    try {
      const response = await openai.responses.create({
        model: env.OPENAI_MEAL_PLAN_MODEL ?? 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }]
          }
        ]
      })

      //   const outputItem = response.output[0]

      // On cherche la première partie texte
      //   const textPart = (outputItem.content as any[]).find(
      //     (c) => c.type === 'output_text' || c.type === 'text'
      //   )
      //   text = textPart?.text ?? textPart?.output_text ?? undefined

      const anyRes = response as any
      text =
        anyRes.output_text ??
        anyRes.output?.[0]?.content?.[0]?.text ??
        anyRes.output?.[0]?.content?.[0]?.content

      if (!text || typeof text !== 'string') {
        throw new Error('No text output from model')
      }
    } catch (error) {
      throw new AppError(
        { ...ERR.SERVER_ERROR, message: 'Failed to generate meal plan.' },
        { reason: 'OPENAI_MEAL_PLAN_ERROR', error }
      )
    }

    try {
      const raw = JSON.parse(text) as unknown
      const parsed = mealPlanSchema.parse(raw)
      return parsed
    } catch (error) {
      throw new AppError(
        { ...ERR.SERVER_ERROR, message: 'Model returned invalid meal plan JSON.' },
        { reason: 'MEAL_PLAN_JSON_PARSE_ERROR', textSnippet: text.slice(0, 500) }
      )
    }
  }
}
