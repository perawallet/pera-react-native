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

export const VerificationState = {
    Unverified: 'UNVERIFIED',
    Pending: 'PENDING',
    Verified: 'VERIFIED',
    Rejected: 'REJECTED',
} as const
export type VerificationState =
    (typeof VerificationState)[keyof typeof VerificationState]

/**
 * True once KYC is submitted — either under review (PENDING) or complete
 * (VERIFIED). The single gate for proceeding past the verification step;
 * UNVERIFIED, REJECTED, and unknown/unfetched (null) states are NOT submitted.
 * Shared so the sign-in resume route and the setup checklist can't drift.
 */
export const isKycSubmitted = (state: Nullable<VerificationState>): boolean =>
    state === VerificationState.Pending || state === VerificationState.Verified

/**
 * True only once KYC review is complete (VERIFIED). Stricter than
 * {@link isKycSubmitted}: Baanx gates card issuance (`POST /v1/card/order`)
 * on this, while the onboarding checklist only needs "submitted".
 */
export const isKycVerified = (state: Nullable<VerificationState>): boolean =>
    state === VerificationState.Verified

/** User profile from GET /v1/user. KYC gate keys off `verificationState`. */
export type CardUser = {
    id: string
    firstName?: string
    lastName?: string
    email?: string
    phoneNumber?: string
    countryOfResidence?: string
    verificationState: VerificationState
}
