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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { OnboardingStep } from './onboarding'
import type { CardStatus } from './card'
import type { CardTransactionFilters } from './transaction'

/** Client-only UX/navigation state. No tokens, no PAN/CVV/PIN. */
export type CardUxState = BaseStoreState & {
    onboardingStep: OnboardingStep
    /** Email entered on the first onboarding step; carried through the flow. */
    email: Nullable<string>
    /** ISO 3166-1 alpha-2 country of residence picked on the first step. */
    countryIso: Nullable<string>
    /**
     * The verification code the user typed. Transient OTP — held in memory only
     * and never persisted (excluded from `partialize`).
     */
    verificationCode: Nullable<string>
    /** Returned by email/send; required by email/verify and phone/send. */
    contactVerificationId: Nullable<string>
    /** Returned by email/verify; required by every later registration step. */
    onboardingId: Nullable<string>
    cardId: Nullable<string>
    lastKnownStatus: Nullable<CardStatus>
    /** PCI-safe render hint shown before the status query resolves. */
    lastKnownPanLast4: Nullable<string>
    transactionFilters: CardTransactionFilters
    setOnboardingStep: (step: OnboardingStep) => void
    setEmail: (email: Nullable<string>) => void
    setCountryIso: (countryIso: Nullable<string>) => void
    setVerificationCode: (verificationCode: Nullable<string>) => void
    setContactVerificationId: (id: Nullable<string>) => void
    setOnboardingId: (id: Nullable<string>) => void
    setCardSnapshot: (snapshot: {
        cardId: string
        status: CardStatus
        panLast4: string
    }) => void
    setTransactionFilters: (filters: CardTransactionFilters) => void
}

/**
 * Non-sensitive auth flag only — a convenience for the UI to gate on. Tokens
 * live only in the KMS keystore; this never holds anything sensitive.
 */
export type CardSessionState = BaseStoreState & {
    isAuthenticated: boolean
    setAuthenticated: (isAuthenticated: boolean) => void
}
