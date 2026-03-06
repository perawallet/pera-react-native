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
import { dexSwapAssetSchema } from '../available-assets/schema'
import { providerEnum } from '../quotes/schema'

export const providerItemSchema = z.object({
    name: providerEnum,
    display_name: z.string(),
    icon_url: z.string(),
})

export const providersResponseSchema = z.object({
    results: z.array(providerItemSchema),
})

export const topPairItemSchema = z.object({
    asset_a: dexSwapAssetSchema,
    asset_b: dexSwapAssetSchema,
    volume_24h_usd: z.string(),
})

export const topPairsResponseSchema = z.object({
    results: z.array(topPairItemSchema),
})

export type ProviderItemApiResponse = z.infer<typeof providerItemSchema>
export type ProvidersApiResponse = z.infer<typeof providersResponseSchema>
export type TopPairItemApiResponse = z.infer<typeof topPairItemSchema>
export type TopPairsApiResponse = z.infer<typeof topPairsResponseSchema>
