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

// GET /v1/cards/supported-countries/ (Pera backend). The endpoint also returns
// a `regions` list, but our supported countries come from Baanx settings — here
// we only need the geo-IP detected `current_region` (note: `alpha_2`, whereas
// `regions[].country` uses `alpha_2_code`). Unknown keys are stripped by zod.
export const currentRegionResponseSchema = z.object({
    current_region: z.object({
        alpha_2: z.string(),
        name: z.string(),
    }),
})
export type CurrentRegionApiResponse = z.infer<
    typeof currentRegionResponseSchema
>
