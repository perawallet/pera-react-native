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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { VerificationState } from './user'

/**
 * Non-sensitive session flag. The access/refresh tokens are NOT here — they
 * live only in the encrypted KMS keystore. This shape is safe to persist.
 */
export type CardSession = {
    isAuthenticated: boolean
}

/**
 * Transit-only token bundle from the OAuth token endpoint
 * (`POST /v1/auth/oauth/token`): a 6h access token plus a 7-day refresh token
 * (both rotate on refresh). Written straight to the KMS keystore; never held
 * in app memory or persisted to a Zustand store.
 */
export type CardSessionTokens = {
    accessToken: string
    /** 7-day OAuth refresh token, exchanged on 401 to keep the user signed in. */
    refreshToken: string
}

/**
 * OAuth step 1 (`GET /api/v3/baanx/oauth/initiate`, proxied): a 10-minute
 * session JWT that the authorize step trades for an authorization code.
 */
export type OauthInitiation = {
    sessionToken: string
}

/**
 * OAuth step 3 (`POST /v1/auth/oauth/authorize`): single-use authorization
 * code plus the echoed CSRF `state`, which callers MUST compare against the
 * value they sent to initiate.
 */
export type OauthAuthorization = {
    code: string
    state: string
}

export const OnboardingPhase = {
    Account: 'ACCOUNT',
    PhoneNumber: 'PHONE_NUMBER',
    PersonalInformation: 'PERSONAL_INFORMATION',
    PhysicalAddress: 'PHYSICAL_ADDRESS',
    MailingAddress: 'MAILING_ADDRESS',
} as const
export type OnboardingPhase =
    (typeof OnboardingPhase)[keyof typeof OnboardingPhase]

/**
 * Outcome of POST /v1/auth/login (OAuth step 2). `accessToken` is the
 * ephemeral 6h token used ONLY to complete the OAuth authorize step — it is
 * never persisted; the durable session pair comes from the token exchange.
 * `accessToken` is null when OTP is still required; `phase` is set only
 * mid-onboarding.
 */
export type LoginResult = {
    accessToken: Nullable<string>
    userId: Nullable<string>
    isOtpRequired: boolean
    phase: Nullable<OnboardingPhase>
    verificationState: Nullable<VerificationState>
    isLinked: boolean
}
