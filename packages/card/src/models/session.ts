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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { VerificationState } from './user'

/**
 * Non-sensitive session flags. The access/refresh tokens are NOT here — they
 * live in the encrypted KMS keystore. This shape is safe to persist.
 */
export type CardSession = {
    isAuthenticated: boolean
    /** Epoch ms when the access token expires, if known. */
    expiresAt: Nullable<number>
}

/**
 * Transit-only token bundle. The full access+refresh pair comes from the OAuth
 * token endpoint (`POST /v1/auth/oauth/token`); direct login yields only a
 * 6-hour access token (no refresh). Written straight to the KMS keystore +
 * in-memory cache; never persisted to a Zustand store.
 */
export type CardSessionTokens = {
    accessToken: string
    /** Empty string for direct-login sessions (no refresh token issued). */
    refreshToken: string
    /** Epoch ms. */
    expiresAt: number
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
 * Outcome of POST /v1/auth/login. Returns only an access token (6h, no refresh
 * token — those come from the OAuth flow). `accessToken` is null when OTP is
 * still required; `phase` is set only mid-onboarding.
 */
export type LoginResult = {
    accessToken: Nullable<string>
    userId: Nullable<string>
    isOtpRequired: boolean
    phase: Nullable<OnboardingPhase>
    verificationState: Nullable<VerificationState>
    isLinked: boolean
}
