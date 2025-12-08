// src/modules/coach/coach.service.ts
import OpenAI from 'openai'
import { env } from '../../config/env'
import type { FastCoachInput } from './coach.types'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
})

function buildFastFeedbackPrompt(input: FastCoachInput): string {
  const { locale, fast, foodSummary, mood, notes, mainGoal } = input

  // Agrégats simples côté code plutôt que laisser le modèle deviner
  let totalCalories = 0
  let totalPostFast = 0
  let totalDays = 0

  if (foodSummary) {
    totalDays = foodSummary.days.length
    for (const d of foodSummary.days) {
      totalCalories += d.totalCalories
      totalPostFast += d.postFastCalories
    }
  }

  const ratioPostFast =
    totalCalories > 0 ? Math.round((totalPostFast / Math.max(totalCalories, 1)) * 100) : 0

  const topRecipes = foodSummary?.topRecipes ?? []

  const goalLabel =
    mainGoal === 'weight_loss'
      ? locale === 'fr'
        ? 'perte de poids'
        : 'weight loss'
      : mainGoal === 'energy'
      ? locale === 'fr'
        ? 'énergie'
        : 'energy'
      : mainGoal === 'health'
      ? locale === 'fr'
        ? 'santé métabolique'
        : 'metabolic health'
      : locale === 'fr'
      ? 'maintien'
      : 'maintenance'

  // Petit résumé structuré qu’on donne au modèle
  const context = {
    fast,
    foodSummary: foodSummary
      ? {
          from: foodSummary.from,
          to: foodSummary.to,
          totalCalories,
          totalPostFast,
          ratioPostFast,
          days: foodSummary.days,
          topRecipes: topRecipes.map((r) => ({
            recipeId: r.recipeId,
            title: r.title,
            totalCalories: r.totalCalories,
            uses: r.uses
          }))
        }
      : null,
    mood: mood ?? null,
    notes: notes ?? null,
    mainGoal
  }

  const baseInstructionFr = `
Tu es un "Fasting Coach" bienveillant.
Tu parles français de manière simple, concrète et motivante.
Tu donnes des conseils personnalisés sur le jeûne, l'alimentation et le comportement.

Voici le contexte JSON (ne le répète pas brut) :
${JSON.stringify(context, null, 2)}

Consignes :
- Commence par un court résumé de l'état actuel de l'utilisateur (1–2 phrases).
- Commente sa discipline APRÈS le jeûne :
  - Analyse "postFastCalories" et "ratioPostFast" (calories juste après la fin des jeûnes).
  - Indique si cette phase post-jeûne est plutôt maîtrisée ou si elle "casse" souvent ses efforts.
- Commente l'utilisation des recettes :
  - Identifie les 1–2 recettes les plus fréquentes.
  - Explique si elles sont cohérentes avec son objectif (${goalLabel}) ou trop caloriques.
  - Propose 1–2 ajustements concrets (portion plus petite, alternative plus légère, changer l'accompagnement...).
- Donne 2–3 conseils actionnables pour les prochains jours :
  - 1 conseil sur la fenêtre d'alimentation (timing, qualité de repas).
  - 1 conseil comportemental (routine, gestion de la faim, organisation).
  - Optionnel : 1 suggestion liée à son humeur ou ses notes si présentes.
- Sois positif, sans culpabiliser. Mets l'accent sur le progrès et les petites améliorations.

Réponds en 2–3 paragraphes maximum, en français.
`

  const baseInstructionEn = `
You are a kind "Fasting Coach".
You speak clearly and concretely, and you give personalized advice on fasting and nutrition.

Here is the JSON context (do not repeat it as-is):
${JSON.stringify(context, null, 2)}

Instructions:
- Start with a short summary of the user's current situation (1–2 sentences).
- Comment on their POST-FAST behavior:
  - Use "postFastCalories" and "ratioPostFast" to analyze how they eat just after ending fasts.
  - Say if this post-fast phase is well managed or if it often breaks their progress.
- Comment on recipe usage:
  - Identify the 1–2 most frequent recipes.
  - Explain if they fit their goal (${goalLabel}) or if they are too calorie dense.
  - Suggest 1–2 concrete tweaks (smaller portion, lighter alternative, change the side dish...).
- Give 2–3 actionable tips for the next days:
  - 1 tip about the eating window (timing, food quality).
  - 1 behavioral tip (routine, hunger management, planning).
  - Optional: 1 suggestion based on mood or notes if available.
- Be positive, without guilt. Focus on progress and small improvements.

Reply in 2–3 short paragraphs, in English.
`

  return locale === 'fr' ? baseInstructionFr : baseInstructionEn
}

export class CoachService {
  async getFastFeedback(input: FastCoachInput): Promise<{ message: string }> {
    const prompt = buildFastFeedbackPrompt(input)

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt
            }
          ]
        }
      ]
    })

    // Lecture du texte selon la Responses API
    const message = response.output_text
    if (!message || message.trim().length === 0) {
      throw new Error('Empty coach response')
    }
    return { message }
  }
}
