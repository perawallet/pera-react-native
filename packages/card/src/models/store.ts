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

import type {
    BaseStoreState,
    Network,
    Nullable,
} from '@perawallet/wallet-core-shared'
import type { OnboardingStep } from './onboarding'
import type { CardStatus } from './card'
import type { CardTransactionFilters } from './transaction'
import type { FundingType } from './funding'

/** Which verification code Baanx rejected, surfaced on the matching verify screen. */
export type CodeVerificationTarget = 'email' | 'phone'

/** Client-only UX/navigation state. No tokens, no PAN/CVV/PIN. */
export type CardUxState = BaseStoreState & {
    onboardingStep: OnboardingStep
    /** Email entered on the first onboarding step; carried through the flow. */
    email: Nullable<string>
    /** ISO 3166-1 alpha-2 country of residence picked on the first step. */
    countryIso: Nullable<string>
    /** Transient OTP — memory only, excluded from `partialize`. */
    verificationCode: Nullable<string>
    /**
     * Drives the inline "code invalid" error. Transient — never persisted,
     * cleared once the user edits the code.
     */
    codeVerificationError: Nullable<CodeVerificationTarget>
    /** Phone dialing code (no leading '+') entered on the phone/send step. */
    phoneCountryCode: Nullable<string>
    /** National phone number entered on the phone/send step. */
    phoneNumber: Nullable<string>
    /** Returned by email/send; required by email/verify and phone/send. */
    contactVerificationId: Nullable<string>
    /** Returned by email/verify; required by every later registration step. */
    onboardingId: Nullable<string>
    /**
     * Persisted so the consent-link step can still bind it after a cross-reload
     * retry, where re-creating returns "Duplicate" with no id.
     */
    consentSetId: Nullable<string>
    /**
     * Captured unchecked on Set-Password, sent on `email/verify`, reused by the
     * address step's `/v2/consent`. `null` means never asked this session (e.g.
     * a resumed sign-in) — the address step must re-collect rather than record
     * a silent "denied".
     */
    allowMarketing: Nullable<boolean>
    /** Same capture and re-collect rules as {@link allowMarketing}. */
    allowSms: Nullable<boolean>
    /** Persisted so the Connect Funds row stays "done" across a cold resume. */
    connectedFundingSourceAddress: Nullable<string>
    /** Persisted so the card-creation step can read it. */
    selectedFundingType: Nullable<FundingType>
    /**
     * Persisted, and left intact by `resetOnboardingProgress`, so a retry
     * reuses the created card instead of creating a second one. Reuse is scoped
     * to BOTH {@link escrowCardOwner} and {@link escrowCardNetwork}.
     */
    escrowCardAddress: Nullable<string>
    /** Funding-source address that owns {@link escrowCardAddress}. */
    escrowCardOwner: Nullable<string>
    /** Network {@link escrowCardAddress} was created on. */
    escrowCardNetwork: Nullable<Network>
    /** Transaction id of the on-chain `cardCreate` call. */
    escrowCardTxId: Nullable<string>
    /**
     * False between a successful create and a successful approve — e.g. an app
     * restart mid-flow — so a retry re-signs and calls approval only, without
     * re-triggering the on-chain create.
     */
    escrowCardApproved: boolean
    cardId: Nullable<string>
    lastKnownStatus: Nullable<CardStatus>
    /** PCI-safe render hint shown before the status query resolves. */
    lastKnownPanLast4: Nullable<string>
    transactionFilters: CardTransactionFilters
    setOnboardingStep: (step: OnboardingStep) => void
    setEmail: (email: Nullable<string>) => void
    setCountryIso: (countryIso: Nullable<string>) => void
    setVerificationCode: (verificationCode: Nullable<string>) => void
    setCodeVerificationError: (target: Nullable<CodeVerificationTarget>) => void
    setPhone: (phone: { phoneCountryCode: string; phoneNumber: string }) => void
    setContactVerificationId: (id: Nullable<string>) => void
    setOnboardingId: (id: Nullable<string>) => void
    setConsentSetId: (id: Nullable<string>) => void
    setAllowMarketing: (allowMarketing: boolean) => void
    setAllowSms: (allowSms: boolean) => void
    setConnectedFundingSourceAddress: (address: Nullable<string>) => void
    setSelectedFundingType: (type: Nullable<FundingType>) => void
    /** Records (or clears, with null) the escrow card, its owner, network, and txId. */
    setEscrowCard: (
        card: Nullable<{
            cardAddress: string
            ownerAddress: string
            network: Network
            txId: string
        }>,
    ) => void
    /** Marks the current escrow card as approved by AB. */
    markEscrowCardApproved: () => void
    setCardSnapshot: (snapshot: {
        cardId: string
        status: CardStatus
        panLast4: string
    }) => void
    setTransactionFilters: (filters: CardTransactionFilters) => void
    /**
     * Clears the onboarding-flow fields when a new sign-up begins. Leaves
     * card-snapshot/transaction state intact (unlike `resetState`).
     */
    resetOnboardingProgress: () => void
}

/**
 * Non-sensitive auth flag only — a convenience for the UI to gate on. Tokens
 * live only in the KMS keystore; this never holds anything sensitive.
 */
export type CardSessionState = BaseStoreState & {
    isAuthenticated: boolean
    setAuthenticated: (isAuthenticated: boolean) => void
}
