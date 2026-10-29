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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { FundingType, OnboardingStep } from '../../models'
import { getLoginPassword } from '../login-password'
import { useCardStore } from '../ux-store'
import {
    clearCardLoginSecrets,
    getCardFundingType,
    getCardOnboardingProgress,
    isEscrowCardApproved,
    isEscrowCardCreated,
    resetCardOnboardingProgress,
    resetCardState,
    setCardFundingSourceAddress,
    setCardFundingType,
    setCardOnboardingStep,
} from '../ux-actions'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: vi.fn() }
})

const state = () => useCardStore.getState()

describe('card store readers and actions', () => {
    beforeEach(() => {
        state().resetState()
    })

    test('getCardOnboardingProgress reflects the onboarding fields', () => {
        useCardStore.setState({
            onboardingStep: OnboardingStep.Address,
            onboardingId: 'ob_1',
            countryIso: 'GB',
            contactVerificationId: 'cv_1',
            email: 'john@example.com',
        })

        expect(getCardOnboardingProgress()).toEqual({
            onboardingStep: OnboardingStep.Address,
            onboardingId: 'ob_1',
            countryIso: 'GB',
            contactVerificationId: 'cv_1',
            email: 'john@example.com',
        })
    })

    test('getCardFundingType is null until a type is selected', () => {
        expect(getCardFundingType()).toBeNull()

        useCardStore.setState({ selectedFundingType: FundingType.Auto })

        expect(getCardFundingType()).toBe(FundingType.Auto)
    })

    test('an escrow card is created once it has an address', () => {
        expect(isEscrowCardCreated()).toBe(false)

        useCardStore.setState({ escrowCardAddress: 'ESCROW' })

        expect(isEscrowCardCreated()).toBe(true)
    })

    test('isEscrowCardApproved needs both an address and the approval flag', () => {
        useCardStore.setState({
            escrowCardAddress: null,
            escrowCardApproved: true,
        })
        expect(isEscrowCardApproved()).toBe(false)

        useCardStore.setState({
            escrowCardAddress: 'ESCROW',
            escrowCardApproved: false,
        })
        expect(isEscrowCardApproved()).toBe(false)

        useCardStore.setState({ escrowCardApproved: true })
        expect(isEscrowCardApproved()).toBe(true)
    })

    test('the setters write the fields they name', () => {
        setCardOnboardingStep(OnboardingStep.Address)
        setCardFundingSourceAddress('FUNDER')
        setCardFundingType(FundingType.Manual)

        expect(state().onboardingStep).toBe(OnboardingStep.Address)
        expect(state().connectedFundingSourceAddress).toBe('FUNDER')
        expect(state().selectedFundingType).toBe(FundingType.Manual)
    })

    test('clearCardLoginSecrets clears the password flag and resets the attempts', () => {
        state().setPassword('Correct-Horse-1234')
        state().recordLoginAttempt({ isAutomatic: false, at: 1 })

        clearCardLoginSecrets()

        expect(state().hasPassword).toBe(false)
        expect(getLoginPassword()).toBeNull()
        expect(state().loginAttempts.total).toBe(0)
    })

    test('resetCardOnboardingProgress restarts onboarding but keeps the escrow card', () => {
        useCardStore.setState({
            onboardingStep: OnboardingStep.Address,
            email: 'john@example.com',
            escrowCardAddress: 'ESCROW',
        })

        resetCardOnboardingProgress()

        expect(state().onboardingStep).toBe(OnboardingStep.EmailSend)
        expect(state().email).toBeNull()
        expect(state().escrowCardAddress).toBe('ESCROW')
    })

    test('resetCardState drops the escrow card too', () => {
        useCardStore.setState({ escrowCardAddress: 'ESCROW' })

        resetCardState()

        expect(state().escrowCardAddress).toBeNull()
    })
})
