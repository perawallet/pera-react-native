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

export const challengeResponseSchema = z.object({ challenge: z.string() })
export const attestResponseSchema = z.object({
    integrity_token: z.string(),
    expires_at: z.string(),
})
export const verifyResponseSchema = z.object({
    ok: z.boolean(),
    device_id: z.string(),
    platform: z.enum(['ios', 'android', 'web']),
})

export type AttestApiResponse = z.infer<typeof attestResponseSchema>
export type VerifyApiResponse = z.infer<typeof verifyResponseSchema>
