import { z } from 'zod'
import { projectResponseSchema } from '../projects/schema'

export const applicationResponseSchema = z.object({
    application_id: z.number(),
    name: z.string(),
    project: projectResponseSchema,
})

export type ApplicationApiResponse = z.infer<typeof applicationResponseSchema>
