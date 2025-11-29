import { z } from 'zod'

export const fastFeedbackSchema = z.object({
  fastId: z.uuid(),
  includeFoodSummary: z.boolean().optional().default(true),
  locale: z.enum(['en', 'fr', 'de']).optional().default('en')
})

export type FastFeedbackInput = z.infer<typeof fastFeedbackSchema>
