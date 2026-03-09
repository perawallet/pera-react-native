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

export const dexSwapAssetSchema = z.object({
    asset_id: z.number().optional(),
    logo: z.string().nullable().optional(),
    name: z.string().optional(),
    unit_name: z.string().optional(),
    total: z.string().optional(),
    fraction_decimals: z.number().optional(),
    verification_tier: z.enum(['verified', 'unverified', 'suspicious']),
    usd_value: z.string().nullable().optional(),
})

export const availableAssetsResponseSchema = z.object({
    results: z.array(dexSwapAssetSchema),
})

export type DexSwapAssetApiResponse = z.infer<typeof dexSwapAssetSchema>
export type AvailableAssetsApiResponse = z.infer<
    typeof availableAssetsResponseSchema
>
