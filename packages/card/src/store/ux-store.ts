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
    phoneVerificationCode: null,
    codeVerificationError: null,
    phoneCountryCode: null,
    phoneNumber: null,
    contactVerificationId: null,
    onboardingId: null,
    consentSetId: null,
    // Defaults to opted-in, matching the address screen's pre-checked box.
    allowMarketing: true,
    connectedFundingSourceAddress: null,
    selectedFundingType: null,
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
            setPhoneVerificationCode: phoneVerificationCode =>
                set({ phoneVerificationCode }),
            setCodeVerificationError: target =>
                set({ codeVerificationError: target }),
            setPhone: ({ phoneCountryCode, phoneNumber }) =>
                set({ phoneCountryCode, phoneNumber }),
            setContactVerificationId: id => set({ contactVerificationId: id }),
            setOnboardingId: id => set({ onboardingId: id }),
            setConsentSetId: id => set({ consentSetId: id }),
            setAllowMarketing: allowMarketing => set({ allowMarketing }),
            setConnectedFundingSourceAddress: address =>
                set({ connectedFundingSourceAddress: address }),
            setSelectedFundingType: type => set({ selectedFundingType: type }),
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
                    phoneVerificationCode: initialState.phoneVerificationCode,
                    codeVerificationError: initialState.codeVerificationError,
                    phoneCountryCode: initialState.phoneCountryCode,
                    phoneNumber: initialState.phoneNumber,
                    contactVerificationId: initialState.contactVerificationId,
                    onboardingId: initialState.onboardingId,
                    consentSetId: initialState.consentSetId,
                    allowMarketing: initialState.allowMarketing,
                    connectedFundingSourceAddress:
                        initialState.connectedFundingSourceAddress,
                    selectedFundingType: initialState.selectedFundingType,
                }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 2,
            // `verificationCode` and `phoneVerificationCode` are intentionally
            // omitted — transient OTPs that should never be written to disk.
            // `email`, `phoneCountryCode` and `phoneNumber` are likewise
            // omitted: KYC PII must not sit in unencrypted MMKV. The trade-off
            // is that a mid-onboarding resume re-prompts for them.
            partialize: state => ({
                onboardingStep: state.onboardingStep,
                countryIso: state.countryIso,
                contactVerificationId: state.contactVerificationId,
                onboardingId: state.onboardingId,
                consentSetId: state.consentSetId,
                allowMarketing: state.allowMarketing,
                connectedFundingSourceAddress:
                    state.connectedFundingSourceAddress,
                selectedFundingType: state.selectedFundingType,
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
