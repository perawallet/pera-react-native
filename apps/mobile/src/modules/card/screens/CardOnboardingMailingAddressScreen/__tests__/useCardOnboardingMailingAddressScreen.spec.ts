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

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupportedUsState } from '@perawallet/wallet-core-card'

const {
    mockMutateAsync,
    mockRequest,
    mockShowError,
    mockErrorToast,
    mockNavigate,
    storeState,
} = vi.hoisted(() => ({
    mockMutateAsync: vi.fn(),
    mockRequest: vi.fn(),
    mockShowError: vi.fn(),
    mockErrorToast: vi.fn(),
    mockNavigate: vi.fn(),
    storeState: { onboardingId: 'mock-onboarding-id' as string | null },
}))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardStore: (selector: (state: typeof storeState) => unknown) =>
        selector(storeState),
    useSubmitMailingAddressMutation: () => ({
        mutateAsync: mockMutateAsync,
        isPending: false,
    }),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('@modules/card/components/CardUsStatePicker', () => ({
    CardUsStatePickerContent: () => null,
}))
vi.mock('@modules/card/hooks', () => ({
    useCardErrorToast: () => mockShowError,
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

import { useCardOnboardingMailingAddressScreen } from '../useCardOnboardingMailingAddressScreen'

const california: SupportedUsState = {
    id: 'ca',
    name: 'California',
    postalAbbreviation: 'CA',
    canSignUp: true,
}

const fillValidAddress = (result: {
    current: ReturnType<typeof useCardOnboardingMailingAddressScreen>
}) => {
    act(() => {
        Object.assign(result.current.control._formValues, {
            addressLine1: '500 Market Street',
            city: 'San Francisco',
            zip: '94105',
            usState: 'CA',
        })
    })
}

describe('useCardOnboardingMailingAddressScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        storeState.onboardingId = 'mock-onboarding-id'
        mockMutateAsync.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'mock-onboarding-id',
            userId: 'user_1',
        })
        mockShowError.mockResolvedValue(undefined)
    })

    it('starts with an invalid form and is not submitting', () => {
        const { result } = renderHook(() =>
            useCardOnboardingMailingAddressScreen(),
        )

        expect(result.current.isValid).toBe(false)
        expect(result.current.isSubmitting).toBe(false)
        expect(result.current.selectedUsState).toBeUndefined()
    })

    it('selects a state from the picker', async () => {
        mockRequest.mockResolvedValueOnce(california)
        const { result } = renderHook(() =>
            useCardOnboardingMailingAddressScreen(),
        )

        act(() => result.current.handleSelectUsState())

        await waitFor(() =>
            expect(result.current.selectedUsState).toEqual(california),
        )
    })

    it('submits the mailing address and hands back to the setup checklist', async () => {
        const { result } = renderHook(() =>
            useCardOnboardingMailingAddressScreen(),
        )
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('CardOnboardingStatus'),
        )
        expect(mockMutateAsync).toHaveBeenCalledWith({
            onboardingId: 'mock-onboarding-id',
            addressLine1: '500 Market Street',
            city: 'San Francisco',
            zip: '94105',
            usState: 'CA',
        })
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('surfaces a rejected submit and stays put', async () => {
        mockMutateAsync.mockRejectedValueOnce(new Error('phase mismatch'))
        const { result } = renderHook(() =>
            useCardOnboardingMailingAddressScreen(),
        )
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() => expect(mockShowError).toHaveBeenCalled())
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('routes back to email verification when the onboarding id is missing', async () => {
        storeState.onboardingId = null
        const { result } = renderHook(() =>
            useCardOnboardingMailingAddressScreen(),
        )
        fillValidAddress(result)

        await act(async () => {
            result.current.handleConfirm()
        })

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith(
                'CardOnboardingEmailVerify',
            ),
        )
        expect(mockErrorToast).toHaveBeenCalled()
        expect(mockMutateAsync).not.toHaveBeenCalled()
    })
})
