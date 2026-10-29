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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    scopeFromNetworkColumn,
    toScopeKey,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    INITIAL_LOGIN_ATTEMPTS,
    OnboardingStep,
    type CardUxState,
} from '../models'
import { setLoginPassword } from './login-password'

const STORE_NAME = 'card-store'

// Client-only UX state. Server truth (card status, transactions, user) lives
// in React Query; secrets (PAN/CVV/PIN/tokens, the onboarding password) never
// enter this store. It only mirrors whether `login-password` holds a password.
const initialState = {
    onboardingStep: OnboardingStep.EmailSend,
    email: null,
    countryIso: null,
    verificationCode: null,
    hasPassword: false,
    loginAttempts: INITIAL_LOGIN_ATTEMPTS,
    codeVerificationError: null,
    phoneCountryCode: null,
    phoneNumber: null,
    contactVerificationId: null,
    onboardingId: null,
    verifiedOnboardingId: null,
    consentSetId: null,
    // Consent opt-ins start as "never asked" — the user ticks them on the
    // Set-Password screen (explicit opt-in, committed on success), and they're
    // sent on the required email/verify call. A resumed session that skipped
    // that screen sees null here and the address step re-collects them instead
    // of recording a silent "denied".
    allowMarketing: null,
    allowSms: null,
    connectedFundingSourceAddress: null,
    // A single global preference, while the on-chain AutoDraw enable it
    // mirrors is per account + network (one on-chain switch per enabler).
    // Holds only because the funding account/type flows keep them in
    // lockstep (change-funding is blocked while Auto is on); scope this per
    // account+network if that constraint is ever lifted.
    selectedFundingType: null,
    cardUserId: null,
    escrowCardAddress: null,
    escrowCardOwner: null,
    escrowCardScopeKey: null,
    escrowCardTxId: null,
    escrowCardApproved: false,
    cardId: null,
    lastKnownStatus: null,
    lastKnownPanLast4: null,
    transactionFilters: {},
}

const scopeKeyOrNull = (value: unknown): Nullable<ChainScopeKey> => {
    if (typeof value !== 'string') return null
    try {
        return toScopeKey(scopeFromNetworkColumn(value))
    } catch {
        // A throw inside a store migration discards the whole store.
        return null
    }
}

/**
 * v0 recorded the escrow card's bare legacy network; v1 records its scope key.
 * Dropping the card on an unreadable value would make the next card setup
 * create a second one, so only that field degrades to null.
 */
export const migrateCardUxState = (
    persistedState: unknown,
    version: number,
): Record<string, unknown> => {
    const state = { ...((persistedState ?? {}) as Record<string, unknown>) }
    if (version < 1) {
        const { escrowCardNetwork, ...rest } = state
        return {
            ...rest,
            escrowCardScopeKey: scopeKeyOrNull(escrowCardNetwork),
        }
    }
    return state
}

export const useCardStore: UseBoundStore<
    WithPersist<StoreApi<CardUxState>, unknown>
> = create<CardUxState>()(
    guardedPersist(
        set => ({
            ...initialState,
            setOnboardingStep: step => set({ onboardingStep: step }),
            setEmail: email => set({ email }),
            setCountryIso: countryIso => set({ countryIso }),
            setVerificationCode: verificationCode => set({ verificationCode }),
            setPassword: password => {
                setLoginPassword(password)
                set({ hasPassword: password !== null })
            },
            recordLoginAttempt: ({ isAutomatic, at }) =>
                set(state => ({
                    loginAttempts: {
                        ...state.loginAttempts,
                        automatic:
                            state.loginAttempts.automatic +
                            (isAutomatic ? 1 : 0),
                        total: state.loginAttempts.total + 1,
                        lastAt: at,
                    },
                })),
            markLoginLocked: () => {
                setLoginPassword(null)
                set(state => ({
                    hasPassword: false,
                    loginAttempts: { ...state.loginAttempts, isLocked: true },
                }))
            },
            clearLoginSecrets: () => {
                setLoginPassword(null)
                set({
                    hasPassword: false,
                    loginAttempts: INITIAL_LOGIN_ATTEMPTS,
                })
            },
            setCodeVerificationError: target =>
                set({ codeVerificationError: target }),
            setPhone: ({ phoneCountryCode, phoneNumber }) =>
                set({ phoneCountryCode, phoneNumber }),
            setContactVerificationId: id => set({ contactVerificationId: id }),
            setOnboardingId: id => set({ onboardingId: id }),
            setVerifiedOnboardingId: id => set({ verifiedOnboardingId: id }),
            setConsentSetId: id => set({ consentSetId: id }),
            setAllowMarketing: allowMarketing => set({ allowMarketing }),
            setAllowSms: allowSms => set({ allowSms }),
            setConnectedFundingSourceAddress: address =>
                set({ connectedFundingSourceAddress: address }),
            setSelectedFundingType: type => set({ selectedFundingType: type }),
            setEscrowCard: card =>
                set({
                    escrowCardAddress: card?.cardAddress ?? null,
                    escrowCardOwner: card?.ownerAddress ?? null,
                    escrowCardScopeKey: card ? toScopeKey(card.scope) : null,
                    escrowCardTxId: card?.txId ?? null,
                    // A newly-set (or cleared) card always starts unapproved —
                    // approval is recorded separately once the AB call succeeds.
                    escrowCardApproved: false,
                }),
            restoreEscrowCard: ({ cardAddress, ownerAddress, scope }) =>
                set({
                    escrowCardAddress: cardAddress,
                    escrowCardOwner: ownerAddress,
                    escrowCardScopeKey: toScopeKey(scope),
                    escrowCardTxId: null,
                    escrowCardApproved: true,
                    connectedFundingSourceAddress: ownerAddress,
                }),
            markEscrowCardApproved: () => set({ escrowCardApproved: true }),
            setCardSnapshot: ({ cardId, status, panLast4 }) =>
                set({
                    cardId,
                    lastKnownStatus: status,
                    lastKnownPanLast4: panLast4,
                }),
            setTransactionFilters: filters =>
                set({ transactionFilters: filters }),
            adoptCardUser: userId =>
                set(state => {
                    if (state.cardUserId === userId) return {}
                    // The escrow card belongs to the previous user's Baanx
                    // account, so it goes along with the funding selection.
                    return {
                        cardUserId: userId,
                        connectedFundingSourceAddress:
                            initialState.connectedFundingSourceAddress,
                        selectedFundingType: initialState.selectedFundingType,
                        escrowCardAddress: initialState.escrowCardAddress,
                        escrowCardOwner: initialState.escrowCardOwner,
                        escrowCardScopeKey: initialState.escrowCardScopeKey,
                        escrowCardTxId: initialState.escrowCardTxId,
                        escrowCardApproved: initialState.escrowCardApproved,
                    }
                }),
            // Reset only the onboarding-flow fields (so a fresh sign-up
            // re-locks the setup checklist); card-snapshot/filters stay intact.
            resetOnboardingProgress: () => {
                setLoginPassword(null)
                set({
                    onboardingStep: initialState.onboardingStep,
                    email: initialState.email,
                    countryIso: initialState.countryIso,
                    verificationCode: initialState.verificationCode,
                    hasPassword: initialState.hasPassword,
                    loginAttempts: initialState.loginAttempts,
                    codeVerificationError: initialState.codeVerificationError,
                    phoneCountryCode: initialState.phoneCountryCode,
                    phoneNumber: initialState.phoneNumber,
                    contactVerificationId: initialState.contactVerificationId,
                    onboardingId: initialState.onboardingId,
                    verifiedOnboardingId: initialState.verifiedOnboardingId,
                    consentSetId: initialState.consentSetId,
                    allowMarketing: initialState.allowMarketing,
                    allowSms: initialState.allowSms,
                    connectedFundingSourceAddress:
                        initialState.connectedFundingSourceAddress,
                    selectedFundingType: initialState.selectedFundingType,
                })
            },
            resetState: () => {
                setLoginPassword(null)
                set(initialState)
            },
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            migrate: migrateCardUxState,
            // `verificationCode`, `hasPassword` and `loginAttempts` are
            // intentionally omitted: secrets and their budget never touch disk.
            // `email`, `phoneCountryCode` and `phoneNumber` are likewise
            // omitted: KYC PII must not sit in unencrypted MMKV. The trade-off
            // is that a mid-onboarding resume re-prompts for them.
            // `allowMarketing`/`allowSms` are also omitted — they're captured
            // afresh on the Set-Password screen each onboarding, so persisting
            // them would only let a stale opted-in value survive an upgrade and
            // silently pre-check the (explicit opt-in) consent boxes.
            partialize: state => ({
                onboardingStep: state.onboardingStep,
                countryIso: state.countryIso,
                contactVerificationId: state.contactVerificationId,
                onboardingId: state.onboardingId,
                verifiedOnboardingId: state.verifiedOnboardingId,
                consentSetId: state.consentSetId,
                connectedFundingSourceAddress:
                    state.connectedFundingSourceAddress,
                selectedFundingType: state.selectedFundingType,
                cardUserId: state.cardUserId,
                escrowCardAddress: state.escrowCardAddress,
                escrowCardOwner: state.escrowCardOwner,
                escrowCardScopeKey: state.escrowCardScopeKey,
                escrowCardTxId: state.escrowCardTxId,
                escrowCardApproved: state.escrowCardApproved,
                cardId: state.cardId,
                lastKnownStatus: state.lastKnownStatus,
                lastKnownPanLast4: state.lastKnownPanLast4,
                transactionFilters: state.transactionFilters,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useCardStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useCardStore.getState().resetState(),
})
