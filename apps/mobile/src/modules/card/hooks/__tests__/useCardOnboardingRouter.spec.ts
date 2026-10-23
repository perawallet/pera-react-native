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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    OnboardingPhase,
    OnboardingStep,
    useCardStore,
    VerificationState,
} from '@perawallet/wallet-core-card'

const mockSession = vi.hoisted(() => ({ hasSession: false }))
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return { ...actual, hasCardSession: () => mockSession.hasSession }
})

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

import { useCardOnboardingRouter } from '../useCardOnboardingRouter'

describe('useCardOnboardingRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSession.hasSession = false
        useCardStore.getState().resetState()
        useCardStore.getState().setCountryIso('GB')
        useCardStore.getState().setContactVerificationId('cv_1')
    })

    it("follows Baanx's phase and mirrors the step into the store", () => {
        const { result } = renderHook(() => useCardOnboardingRouter())

        result.current.goToNextStep({
            phase: OnboardingPhase.AdditionalDetails,
            localStep: OnboardingStep.Address,
        })

        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingAdditionalDetails',
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.AdditionalDetails,
        )
    })

    it('falls back to the local order without a phase', () => {
        const { result } = renderHook(() => useCardOnboardingRouter())

        result.current.goToNextStep({ localStep: OnboardingStep.Verification })

        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingVerification')
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Verification,
        )
    })

    it('reads the residence from the store for the mailing decision', () => {
        useCardStore.getState().setCountryIso('US')
        const { result } = renderHook(() => useCardOnboardingRouter())

        result.current.goToNextStep({
            phase: OnboardingPhase.MailingAddress,
            localStep: OnboardingStep.MailingAddress,
        })

        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingMailingAddress',
        )
    })

    it('waits on the checklist when KYC is already under review', () => {
        const { result } = renderHook(() => useCardOnboardingRouter())

        result.current.goToNextStep({
            localStep: OnboardingStep.Verification,
            verificationState: VerificationState.Pending,
        })

        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus')
    })

    it('goes to the checklist once a session exists', () => {
        mockSession.hasSession = true
        const { result } = renderHook(() => useCardOnboardingRouter())

        const route = result.current.goToNextStep({
            localStep: OnboardingStep.Verification,
        })

        expect(route.step).toBe(OnboardingStep.Completed)
        expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus')
    })
})
