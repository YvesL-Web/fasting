import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'

import { env } from '../../config/env'
import type { FoodScanResult, FoodScanSuggestion } from './food-scan.types'
import { AppError, ERR } from '../../utils/error'
import { CreateFoodItemInput } from '../food/schemas/food-item.schemas'
import { FoodItemService } from '../food/services/food-item.service'

// modèle vision (tu peux le mettre dans env)
const VISION_MODEL = env.OPENAI_VISION_MODEL ?? 'gpt-4.1-mini' // à adapter selon ton compte

export class FoodScanService {
  private openai: OpenAI

  constructor(private readonly foodItemService: FoodItemService) {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  }

  /**
   * Lit l'image sur disque, la convertit en base64 et appelle l'IA
   */
  async scanImageFile(
    userId: string,
    filePath: string,
    opts?: { autoCreateItems?: boolean }
  ): Promise<FoodScanResult> {
    const buffer = await fs.readFile(filePath)
    const base64 = buffer.toString('base64')
    const mimeType = this.inferMimeType(filePath)

    const suggestions = await this.callVisionModel(base64, mimeType)

    let createdItemIds: string[] = []
    if (opts?.autoCreateItems) {
      createdItemIds = await this.createFoodItemsFromSuggestions(userId, suggestions)
    }

    return {
      suggestions,
      createdItemIds: createdItemIds.length > 0 ? createdItemIds : undefined
    }
  }

  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    return 'image/jpeg'
  }

  private async callVisionModel(base64: string, mimeType: string): Promise<FoodScanSuggestion[]> {
    const dataUrl = `data:${mimeType};base64,${base64}`

    const response = await this.openai.responses.create({
      model: VISION_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Tu es un assistant nutrition. ' +
                'Analyse cette photo de repas et retourne UNIQUEMENT un JSON (aucun texte autour). ' +
                'Le JSON doit avoir cette forme : ' +
                '{ "suggestions": [ { "label": string, "calories": number | null, "proteinGrams": number | null, "carbsGrams": number | null, "fatGrams": number | null, "confidence": number } ] }. ' +
                'confidence doit être entre 0 et 1. ' +
                "Limite-toi à 5 aliments maximum. N'invente pas si tu n'es pas sûr."
            },
            {
              type: 'input_image',
              image_url: dataUrl,
              detail: 'auto'
            }
          ]
        }
      ]
    })

    // On reste souple sur la structure de retour du SDK
    const anyRes = response as any
    // Dans la doc, output_text agrège le texte final
    const text: string | undefined =
      anyRes.output_text ??
      anyRes.output?.[0]?.content?.[0]?.text ??
      anyRes.output?.[0]?.content?.[0]?.content

    if (!text) {
      throw new AppError(
        { ...ERR.SERVER_ERROR, message: 'No text output from AI food scan.' },
        { reason: 'FOOD_SCAN_NO_TEXT_OUTPUT', raw: anyRes }
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw new AppError(
        { ...ERR.SERVER_ERROR, message: 'Failed to parse AI JSON output.' },
        { reason: 'FOOD_SCAN_JSON_PARSE_ERROR', rawText: text }
      )
    }

    const obj = parsed as { suggestions?: FoodScanSuggestion[] }

    if (!obj || !Array.isArray(obj.suggestions)) {
      throw new AppError(
        { ...ERR.SERVER_ERROR, message: 'Invalid AI JSON structure.' },
        { reason: 'FOOD_SCAN_INVALID_JSON', parsed: obj }
      )
    }

    const suggestions = obj.suggestions
      .map((s) => ({
        label: String((s as any).label || '').trim(),
        calories:
          typeof (s as any).calories === 'number'
            ? (s as any).calories
            : (s as any).calories ?? null,
        proteinGrams:
          typeof (s as any).proteinGrams === 'number'
            ? (s as any).proteinGrams
            : (s as any).proteinGrams ?? null,
        carbsGrams:
          typeof (s as any).carbsGrams === 'number'
            ? (s as any).carbsGrams
            : (s as any).carbsGrams ?? null,
        fatGrams:
          typeof (s as any).fatGrams === 'number'
            ? (s as any).fatGrams
            : (s as any).fatGrams ?? null,
        confidence: (() => {
          const c = Number((s as any).confidence)
          if (!Number.isFinite(c)) return 0
          return Math.max(0, Math.min(1, c))
        })()
      }))
      .filter((s) => s.label.length > 0)

    return suggestions
  }

  private async createFoodItemsFromSuggestions(
    userId: string,
    suggestions: FoodScanSuggestion[]
  ): Promise<string[]> {
    const ids: string[] = []

    for (const s of suggestions) {
      // on peut filtrer sur confidence pour éviter de créer n'importe quoi
      if (s.confidence < 0.5) continue

      const input: CreateFoodItemInput = {
        label: s.label,
        calories: s.calories ?? undefined,
        proteinGrams: s.proteinGrams ?? undefined,
        carbsGrams: s.carbsGrams ?? undefined,
        fatGrams: s.fatGrams ?? undefined
      }

      const item = await this.foodItemService.createUserFood(userId, input)
      ids.push(item.id)
    }

    return ids
  }
}
