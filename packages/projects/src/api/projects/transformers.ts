/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
