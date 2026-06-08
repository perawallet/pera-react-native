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

// POST /v1/auth/login. Returns only a 6-hour access token (no refresh token —
// those come from the OAuth flow). `accessToken` is null when OTP is required.
export const loginResponseSchema = z.object({
    accessToken: z.string().optional().nullable(),
    userId: z.string().optional().nullable(),
    isOtpRequired: z.boolean().optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    phase: z.string().optional().nullable(),
    verificationState: z.string().optional().nullable(),
    isLinked: z.boolean().optional().nullable(),
})
export type LoginApiResponse = z.infer<typeof loginResponseSchema>

// POST /v1/auth/oauth/token (grant_type=refresh_token). Proxied via Pera's
// backend because it requires the server-only x-secret-key.
export const tokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    refresh_token_expires_in: z.number().optional().nullable(),
})
export type TokenApiResponse = z.infer<typeof tokenResponseSchema>
