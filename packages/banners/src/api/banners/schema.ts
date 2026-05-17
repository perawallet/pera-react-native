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

import { z } from 'zod'

export const bannerTypeResponseSchema = z.enum([
    'generic',
    'governance',
    'staking',
    'card',
    'retail',
])

export const bannerAutoOpenModeResponseSchema = z.enum(['select', 'force'])

export const bannerResponseSchema = z.object({
    id: z.number(),
    type: bannerTypeResponseSchema.catch('generic'),
    title: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    button_label: z.string().nullable().optional(),
    button_url: z.string().nullable().optional(),
    button_web_url: z.string().nullable().optional(),
    is_button_url_external: z.boolean().optional().default(false),
    // Forward-compatible: backend may not send these yet. `.catch(null)` keeps
    // forward-compat for any new mode value the server might add later.
    auto_open_mode: bannerAutoOpenModeResponseSchema
        .nullable()
        .optional()
        .catch(null),
    background_image: z.string().nullable().optional(),
})

export const bannerListResponseSchema = z.object({
    count: z.number().optional(),
    results: z.array(bannerResponseSchema),
})

export type BannerResponse = z.infer<typeof bannerResponseSchema>
export type BannerListResponse = z.infer<typeof bannerListResponseSchema>
