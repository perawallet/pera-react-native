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
import type { CardUxState, FundingType, OnboardingStep } from '../models'
import { useCardStore } from './ux-store'

export type CardOnboardingProgress = Pick<
    CardUxState,
    | 'onboardingStep'
    | 'onboardingId'
    | 'countryIso'
    | 'contactVerificationId'
    | 'email'
>

// Plain functions for event-time reads: a value a hook captured at render goes
// stale across an `await`, these read the store when they are called.

export const getCardOnboardingProgress = (): CardOnboardingProgress => {
    const {
        onboardingStep,
        onboardingId,
        countryIso,
        contactVerificationId,
        email,
    } = useCardStore.getState()
    return {
        onboardingStep,
        onboardingId,
        countryIso,
        contactVerificationId,
        email,
    }
}

export const getCardFundingType = (): Nullable<FundingType> =>
    useCardStore.getState().selectedFundingType

export const isEscrowCardCreated = (): boolean =>
    useCardStore.getState().escrowCardAddress !== null

export const isEscrowCardApproved = (): boolean =>
    isEscrowCardCreated() && useCardStore.getState().escrowCardApproved

export const setCardOnboardingStep = (step: OnboardingStep): void =>
    useCardStore.getState().setOnboardingStep(step)

export const setCardFundingSourceAddress = (address: Nullable<string>): void =>
    useCardStore.getState().setConnectedFundingSourceAddress(address)

export const setCardFundingType = (type: Nullable<FundingType>): void =>
    useCardStore.getState().setSelectedFundingType(type)

export const clearCardLoginSecrets = (): void =>
    useCardStore.getState().clearLoginSecrets()

export const resetCardOnboardingProgress = (): void =>
    useCardStore.getState().resetOnboardingProgress()

export const resetCardState = (): void => useCardStore.getState().resetState()
