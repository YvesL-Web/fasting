import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  locale: z.enum(['en', 'fr', 'de'])
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
