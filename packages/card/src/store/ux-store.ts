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
    phoneCountryCode: null,
    phoneNumber: null,
    contactVerificationId: null,
    onboardingId: null,
    // Defaults to opted-in, matching the address screen's pre-checked box.
    allowMarketing: true,
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
            setPhone: ({ phoneCountryCode, phoneNumber }) =>
                set({ phoneCountryCode, phoneNumber }),
            setContactVerificationId: id => set({ contactVerificationId: id }),
            setOnboardingId: id => set({ onboardingId: id }),
            setAllowMarketing: allowMarketing => set({ allowMarketing }),
            setCardSnapshot: ({ cardId, status, panLast4 }) =>
                set({
                    cardId,
                    lastKnownStatus: status,
                    lastKnownPanLast4: panLast4,
                }),
            setTransactionFilters: filters =>
                set({ transactionFilters: filters }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            // `verificationCode` is intentionally omitted — it's a transient
            // OTP that should never be written to disk.
            partialize: state => ({
                onboardingStep: state.onboardingStep,
                email: state.email,
                countryIso: state.countryIso,
                phoneCountryCode: state.phoneCountryCode,
                phoneNumber: state.phoneNumber,
                contactVerificationId: state.contactVerificationId,
                onboardingId: state.onboardingId,
                allowMarketing: state.allowMarketing,
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
