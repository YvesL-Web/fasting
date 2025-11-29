import { Repository } from 'typeorm'
import { subDays, format as formatDate } from 'date-fns'

import { FastEntity } from '../fasts/fast.entity'
import { FoodEntryEntity } from '../food/food-entry.entity'
import { UserEntity } from '../users/user.entity'
import { FoodEntryService } from '../food/food-entry.service'
import type { FastFeedbackInput } from './coach.schemas'

import { AppError, ERR } from '../../utils/error'
import { FoodDaySummary } from '../food/food-entry.schemas'
import { openai } from '../../config/openai'

export type CoachFeedback = {
  message: string
  tips: string[]
}

export class CoachService {
  private readonly foodService: FoodEntryService

  constructor(
    private readonly fastsRepo: Repository<FastEntity>,
    foodRepo: Repository<FoodEntryEntity>,
    usersRepo: Repository<UserEntity>
  ) {
    this.foodService = new FoodEntryService(foodRepo, fastsRepo, usersRepo)
  }

  private formatFoodSummary(days: FoodDaySummary[]): string {
    if (!days.length) return 'Aucun repas enregistré sur les 7 derniers jours.'

    const lines = days.map((d) => {
      return `- ${d.day}: ${d.totalCalories} kcal (dans fenêtre: ${d.inWindowCalories} kcal, hors fenêtre: ${d.outWindowCalories} kcal, repas: ${d.entriesCount})`
    })

    return lines.join('\n')
  }

  async getFastFeedback(userId: string, input: FastFeedbackInput): Promise<CoachFeedback> {
    const fast = await this.fastsRepo.findOne({
      where: { id: input.fastId, user: { id: userId } },
      relations: ['user']
    })

    if (!fast) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Jeûne introuvable.' },
        { reason: 'FAST_NOT_FOUND', fastId: input.fastId }
      )
    }

    const user = fast.user

    const start = fast.startAt
    const end = fast.endAt ?? new Date()
    const durationMs = Math.max(0, end.getTime() - start.getTime())
    const durationHours = durationMs / (1000 * 60 * 60)

    const targetHours = fast.targetDurationHours ?? null
    const type = fast.type

    // Summary alimentaire sur les 7 derniers jours avant la fin du jeûne (ou aujourd’hui)
    let foodSummaryText = ''
    if (input.includeFoodSummary) {
      const baseDate = fast.endAt ?? new Date()
      const from = subDays(baseDate, 6)
      const fromStr = formatDate(from, 'yyyy-MM-dd')
      const toStr = formatDate(baseDate, 'yyyy-MM-dd')

      const summary = await this.foodService.getSummary(userId, { from: fromStr, to: toStr })
      foodSummaryText = this.formatFoodSummary(summary.days)
    }

    const locale = input.locale ?? 'fr'

    const systemPrompt =
      locale === 'fr'
        ? `Tu es un coach spécialisé dans le jeûne intermittent. Tu donnes des retours bienveillants, concrets, et actionnables. Tu t'adresses à l'utilisateur à la deuxième personne ("tu").`
        : locale === 'de'
        ? `Du bist ein Coach für Intervallfasten. Du gibst freundliches, konkretes und umsetzbares Feedback und sprichst den Nutzer mit "du" an.`
        : `You are a coach specialized in intermittent fasting. You give friendly, concrete, actionable feedback, and you speak to the user in a motivating way.`

    const userPrompt =
      locale === 'fr'
        ? `
Voici les données du dernier jeûne de l'utilisateur:

- Type: ${type}
- Durée réelle: ${durationHours.toFixed(1)} heures
- Durée cible: ${targetHours ? `${targetHours} heures` : 'non définie'}
- Démarré le: ${fast.startAt.toISOString()}
- Terminé le: ${fast.endAt ? fast.endAt.toISOString() : 'encore en cours'}

Historique alimentation (7 derniers jours):
${foodSummaryText || 'Aucune donnée.'}

Objectif: Donne un retour synthétique (max ~8 phrases) qui inclut:
1. Ce que l'utilisateur fait bien.
2. 2 à 3 pistes concrètes d'amélioration.
3. Une suggestion pour le prochain jeûne (durée, timing, alimentation).
4. Un ton motivant, sans jugement.

Réponds au format JSON STRICT avec les clés:
{
  "message": "paragraphe principal",
  "tips": ["tip 1", "tip 2", "tip 3"]
}
`
        : locale === 'de'
        ? `
Hier sind die Daten des letzten Fastens des Nutzers:

- Typ: ${type}
- Tatsächliche Dauer: ${durationHours.toFixed(1)} Stunden
- Ziel-Dauer: ${targetHours ? `${targetHours} Stunden` : 'nicht definiert'}
- Start: ${fast.startAt.toISOString()}
- Ende: ${fast.endAt ? fast.endAt.toISOString() : 'läuft noch'}

Ernährungs-Historie (letzte 7 Tage):
${foodSummaryText || 'Keine Daten.'}

Ziel: Gib kurzes Feedback (max ~8 Sätze), das enthält:
1. Was der Nutzer gut macht.
2. 2–3 konkrete Verbesserungsvorschläge.
3. Eine Empfehlung für das nächste Fasten (Dauer, Timing, Ernährung).
4. Einen motivierenden, nicht wertenden Ton.

Antwort STRICT als JSON mit den Keys:
{
  "message": "Haupt-Abschnitt",
  "tips": ["Tipp 1", "Tipp 2", "Tipp 3"]
}
`
        : `
Here is the user's last fast:

- Type: ${type}
- Actual duration: ${durationHours.toFixed(1)} hours
- Target duration: ${targetHours ? `${targetHours} hours` : 'not set'}
- Started at: ${fast.startAt.toISOString()}
- Ended at: ${fast.endAt ? fast.endAt.toISOString() : 'still ongoing'}

Food history (last 7 days):
${foodSummaryText || 'No data.'}

Goal: Provide concise feedback (max ~8 sentences) including:
1. What the user is doing well.
2. 2–3 specific suggestions for improvement.
3. A recommendation for the next fast (duration, timing, nutrition).
4. A friendly, motivating tone.

Reply in STRICT JSON with keys:
{
  "message": "main paragraph",
  "tips": ["tip 1", "tip 2", "tip 3"]
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })

    const raw = completion.choices[0]?.message?.content ?? ''

    let parsed: CoachFeedback | null = null
    try {
      parsed = JSON.parse(raw) as CoachFeedback
    } catch {
      // fallback super simple si le modèle ne retourne pas du JSON propre
      parsed = {
        message: raw || "Je n'ai pas pu générer un feedback structuré pour ce jeûne.",
        tips: []
      }
    }

    if (!parsed.message) {
      parsed.message = "Je n'ai pas pu générer un feedback utile pour ce jeûne."
    }
    if (!Array.isArray(parsed.tips)) {
      parsed.tips = []
    }

    return parsed
  }
}
