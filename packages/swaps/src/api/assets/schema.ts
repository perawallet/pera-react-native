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

// The router's asset item is the `/api/v4/assets/` item; swap reads only these
// fields, so a chain-specific addition never fails a whole page.
export const swapAssetItemSchema = z.object({
    /** CAIP-19. */
    asset_id: z.string(),
    name: z.string().nullish(),
    unit_name: z.string().nullish(),
    fraction_decimals: z.number().int().min(0).nullish(),
    logo: z.string().nullish(),
    verification_tier: z.string().nullish(),
    cross_chain_asset_group: z
        .object({ id: z.string(), name: z.string(), symbol: z.string() })
        .nullish(),
})

export type SwapAssetItemApiResponse = z.infer<typeof swapAssetItemSchema>
