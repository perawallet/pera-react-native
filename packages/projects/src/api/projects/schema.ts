import { z } from 'zod'

export const categorySimpleSchema = z.object({
    id: z.string(),
    title: z.string().optional().nullable(),
    order: z.number().optional().nullable(),
})

export const projectResponseSchema = z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    short_description: z.string(),
    logo_png: z.string(),
    verification_tier: z.enum(['verified', 'unverified', 'suspicious']),
    color: z.string().optional().nullable(),
    text_color: z.string().optional().nullable(),
    background_image: z.string().optional().nullable(),
    categories: z.array(categorySimpleSchema).optional().nullable(),
    popularity_score: z.number().optional().nullable(),
})

export const projectListResponseSchema = z.array(projectResponseSchema)

export type ProjectApiResponse = z.infer<typeof projectResponseSchema>
