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

export const spotBannerResponseSchema = z.object({
    id: z.number(),
    text: z.string(),
    image: z.string().url(),
    url: z.string(),
    button_url_is_external: z.boolean().optional().default(false),
})

export const spotBannerListResponseSchema = z.array(spotBannerResponseSchema)

export type SpotBannerResponse = z.infer<typeof spotBannerResponseSchema>
export type SpotBannerListResponse = z.infer<
    typeof spotBannerListResponseSchema
>
