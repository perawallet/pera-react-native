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

// POST /v1/card/details/token and POST /v1/card/pin/token each return a
// single-use token + an image URL that renders the sensitive value (PAN/CVV
// or PIN). Raw values are never returned by the API.
export const cardSecureViewResponseSchema = z.object({
    token: z.string(),
    imageUrl: z.string(),
})
export type CardSecureViewApiResponse = z.infer<
    typeof cardSecureViewResponseSchema
>

// POST /v1/card/set-pin/token returns a token + a hosted page URL the user
// opens to set their PIN.
export const cardSetPinSessionResponseSchema = z.object({
    token: z.string(),
    hostedPageUrl: z.string(),
})
export type CardSetPinSessionApiResponse = z.infer<
    typeof cardSetPinSessionResponseSchema
>
