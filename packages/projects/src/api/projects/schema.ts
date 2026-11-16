/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { z } from 'zod'

const categorySimpleSchema = z.object({
    id: z.string(),
    title: z.string().optional().nullable(),
    order: z.number().optional().nullable(),
})

export const projectResponseSchema = z.object({
    id: z.string().optional(),
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
    chains: z.array(z.string()).optional().nullable(),
})

export const projectListResponseSchema = z.array(projectResponseSchema)

export type ProjectApiResponse = z.infer<typeof projectResponseSchema>
