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
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { OnboardingStep, type CardUxState } from '../models'

const STORE_NAME = 'card-store'

// Client-only UX state. Server truth (card status, transactions, user) lives
// in React Query; secrets (PAN/CVV/PIN/tokens) never enter this store.
const initialState = {
    onboardingStep: OnboardingStep.EmailSend,
    email: null,
    countryIso: null,
    verificationCode: null,
    codeVerificationError: null,
    phoneCountryCode: null,
    phoneNumber: null,
    contactVerificationId: null,
    onboardingId: null,
    consentSetId: null,
    // Consent opt-ins start as "never asked" — the user ticks them on the
    // Set-Password screen (explicit opt-in, committed on success), and they're
    // sent on the required email/verify call. A resumed session that skipped
    // that screen sees null here and the address step re-collects them instead
    // of recording a silent "denied".
    allowMarketing: null,
    allowSms: null,
    connectedFundingSourceAddress: null,
    selectedFundingType: null,
    escrowCardAddress: null,
    escrowCardOwner: null,
    escrowCardNetwork: null,
    cardId: null,
    lastKnownStatus: null,
    lastKnownPanLast4: null,
    transactionFilters: {},
}

export const useCardStore: UseBoundStore<
    WithPersist<StoreApi<CardUxState>, unknown>
> = create<CardUxState>()(
    persist(
        set => ({
            ...initialState,
            setOnboardingStep: step => set({ onboardingStep: step }),
            setEmail: email => set({ email }),
            setCountryIso: countryIso => set({ countryIso }),
            setVerificationCode: verificationCode => set({ verificationCode }),
            setCodeVerificationError: target =>
                set({ codeVerificationError: target }),
            setPhone: ({ phoneCountryCode, phoneNumber }) =>
                set({ phoneCountryCode, phoneNumber }),
            setContactVerificationId: id => set({ contactVerificationId: id }),
            setOnboardingId: id => set({ onboardingId: id }),
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
                    escrowCardNetwork: card?.network ?? null,
                }),
            setCardSnapshot: ({ cardId, status, panLast4 }) =>
                set({
                    cardId,
                    lastKnownStatus: status,
                    lastKnownPanLast4: panLast4,
                }),
            setTransactionFilters: filters =>
                set({ transactionFilters: filters }),
            // Reset only the onboarding-flow fields (so a fresh sign-up
            // re-locks the setup checklist); card-snapshot/filters stay intact.
            resetOnboardingProgress: () =>
                set({
                    onboardingStep: initialState.onboardingStep,
                    email: initialState.email,
                    countryIso: initialState.countryIso,
                    verificationCode: initialState.verificationCode,
                    codeVerificationError: initialState.codeVerificationError,
                    phoneCountryCode: initialState.phoneCountryCode,
                    phoneNumber: initialState.phoneNumber,
                    contactVerificationId: initialState.contactVerificationId,
                    onboardingId: initialState.onboardingId,
                    consentSetId: initialState.consentSetId,
                    allowMarketing: initialState.allowMarketing,
                    allowSms: initialState.allowSms,
                    connectedFundingSourceAddress:
                        initialState.connectedFundingSourceAddress,
                    selectedFundingType: initialState.selectedFundingType,
                }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            // `verificationCode` is intentionally omitted — a transient OTP
            // that should never be written to disk.
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
                consentSetId: state.consentSetId,
                connectedFundingSourceAddress:
                    state.connectedFundingSourceAddress,
                selectedFundingType: state.selectedFundingType,
                escrowCardAddress: state.escrowCardAddress,
                escrowCardOwner: state.escrowCardOwner,
                escrowCardNetwork: state.escrowCardNetwork,
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
