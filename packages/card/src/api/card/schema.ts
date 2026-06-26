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

// GET /v1/card/status. Status/type are validated as strings and mapped to
// known enum members by the transformer so a new Baanx value never throws.
export const cardStatusResponseSchema = z.object({
    id: z.string(),
    // Not part of the /v1/card/status payload — optional so the response still
    // validates without them (a missing required field would fail the whole
    // parse and drop the card status, hiding the frozen state).
    holderName: z.string().optional(),
    expiryDate: z.string().optional(),
    panLast4: z.string(),
    status: z.string(),
    type: z.string(),
    orderedAt: z.string(),
})
export type CardStatusApiResponse = z.infer<typeof cardStatusResponseSchema>
