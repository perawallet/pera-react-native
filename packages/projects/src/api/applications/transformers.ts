import type { ApplicationApiResponse } from './schema'
import { transformProject } from '../projects/transformers'
import type { PeraApplication } from '../../models/types'

export const transformApplication = (
    response: ApplicationApiResponse,
): PeraApplication => ({
    applicationId: response.application_id,
    name: response.name,
    project: transformProject(response.project),
})
