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
    /**
     * The email verification code the user typed. Transient OTP — held in
     * memory only and never persisted (excluded from `partialize`).
     */
    verificationCode: Nullable<string>
    /**
     * Set when a verification code is rejected — 'email' by the Set-Password
     * step (where `email/verify` fires), 'phone' by the phone-verify screen —
     * so the matching verify screen can show an inline "code invalid" error.
     * Transient — never persisted; cleared once the user edits the code.
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
     * Returned by the consent-create step (`POST /v2/consent/onboarding`).
     * Persisted so the consent-link step can still bind it to the user after a
     * cross-reload retry (where re-creating returns "Duplicate" with no id).
     */
    consentSetId: Nullable<string>
    /**
     * Marketing-communication opt-in. Captured (unchecked by default) on the
     * Set-Password screen, sent on the required `email/verify` call, and reused
     * by the address-step `/v2/consent` call (drives marketing + email consents).
     * `null` = never asked this session (e.g. a resumed sign-in that skipped
     * the Set-Password screen) — the address step must re-collect it rather
     * than record a silent "denied".
     */
    allowMarketing: Nullable<boolean>
    /**
     * SMS-communication opt-in. Captured alongside `allowMarketing` on the
     * Set-Password screen and sent on `email/verify` (both are required there);
     * drives the `smsNotifications` consent independently at the address step.
     * `null` = never asked this session, same re-collect rule as
     * `allowMarketing`.
     */
    allowSms: Nullable<boolean>
    /**
     * Address of the Pera account connected as the card's funding source on the
     * setup checklist's Connect Funds step. Persisted so the row stays "done"
     * across a cold resume.
     */
    connectedFundingSourceAddress: Nullable<string>
    /**
     * Funding type (Auto vs Manual) chosen on the setup checklist's "Select
     * Funding Type" step. Persisted so the card-creation step can read it.
     */
    selectedFundingType: Nullable<FundingType>
    /**
     * Escrow card account address returned by the backend card-creation call,
     * plus the transaction id of the on-chain `cardCreate`, the funding
     * account, and the network it was created for. Persisted (and left
     * intact by `resetOnboardingProgress`) so a retry reuses the
     * already-created card instead of creating a second one. Reuse is scoped
     * to BOTH `escrowCardOwner` and `escrowCardNetwork` — a different funding
     * account, or the same account on the other network, never reuses this
     * card.
     */
    escrowCardAddress: Nullable<string>
    /** Funding-source address that owns {@link escrowCardAddress}. */
    escrowCardOwner: Nullable<string>
    /** Network {@link escrowCardAddress} was created on. */
    escrowCardNetwork: Nullable<Network>
    /** Transaction id of the on-chain `cardCreate` call. */
    escrowCardTxId: Nullable<string>
    /**
     * Whether the AB approval call (which carries {@link escrowCardTxId})
     * has succeeded for the current {@link escrowCardAddress}. False between
     * a successful create and a successful approve — e.g. after an app
     * restart mid-flow — so a retry knows to re-sign and call approval only,
     * without re-triggering the on-chain create.
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
