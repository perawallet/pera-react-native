import type { ProjectApiResponse } from './schema'
import type { PeraProject } from '../../models/types'

export const transformProject = (
    response: ProjectApiResponse,
): PeraProject => ({
    name: response.name,
    url: response.url,
    description: response.description,
    shortDescription: response.short_description,
    logoPng: response.logo_png,
    verificationTier: response.verification_tier,
    color: response.color || undefined,
    textColor: response.text_color || undefined,
    backgroundImage: response.background_image || undefined,
    categories:
        response.categories?.map(category => ({
            id: category.id,
            title: category.title || undefined,
            order: category.order || undefined,
        })) || [],
    popularityScore: response.popularity_score || undefined,
})

export const transformProjectList = (
    responses: ProjectApiResponse[],
): PeraProject[] => responses.map(transformProject)
