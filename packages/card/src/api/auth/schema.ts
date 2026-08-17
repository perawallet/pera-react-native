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

// POST /v1/auth/login/otp — asks Baanx to send the 2FA code for a user whose
// login came back `isOtpRequired`.
export const sendLoginOtpResponseSchema = z.object({
    success: z.boolean().optional().nullable(),
})
export type SendLoginOtpApiResponse = z.infer<typeof sendLoginOtpResponseSchema>

// GET /api/v3/baanx/oauth/initiate (Pera proxy for Baanx's
// /v1/auth/oauth/authorize/initiate, mode=api). `token` is a 10-minute session
// JWT consumed by the authorize step. The response also carries a hosted-UI
// `url` that API mode never uses, so it is not modeled here.
export const oauthInitiateResponseSchema = z.object({
    token: z.string(),
})
export type OauthInitiateApiResponse = z.infer<
    typeof oauthInitiateResponseSchema
>

// POST /v1/auth/oauth/authorize — trades the session JWT + login Bearer for a
// single-use authorization code. `state` echoes the CSRF value from initiate.
// (The response's redirect `url` is unused in API mode and not modeled.)
export const oauthAuthorizeResponseSchema = z.object({
    code: z.string(),
    state: z.string(),
})
export type OauthAuthorizeApiResponse = z.infer<
    typeof oauthAuthorizeResponseSchema
>

// POST /v1/auth/oauth/token — both grants return the same shape: a 6h access
// token and a 7-day refresh token (the code grant is proxied via Pera's
// backend, the refresh grant goes direct with x-client-key).
export const tokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    refresh_token_expires_in: z.number().optional().nullable(),
})
export type TokenApiResponse = z.infer<typeof tokenResponseSchema>

// POST /v1/auth/password/reset/request. Baanx answers {success: true} even
// for unknown emails (no account enumeration), so `false` is unexpected and
// treated as an error by the endpoint.
export const passwordResetRequestResponseSchema = z.object({
    success: z.boolean().optional().nullable(),
})
export type PasswordResetRequestApiResponse = z.infer<
    typeof passwordResetRequestResponseSchema
>

// POST /v1/auth/password/reset/verify. `token` is the single-use reset key
// consumed by the confirm step; it expires after a short period.
export const passwordResetVerifyResponseSchema = z.object({
    token: z.string(),
})
export type PasswordResetVerifyApiResponse = z.infer<
    typeof passwordResetVerifyResponseSchema
>

// POST /v1/auth/password/reset/confirm.
export const passwordResetConfirmResponseSchema = z.object({
    success: z.boolean().optional().nullable(),
})
export type PasswordResetConfirmApiResponse = z.infer<
    typeof passwordResetConfirmResponseSchema
>
