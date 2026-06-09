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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CardStatus, OnboardingStep } from '../../models'

const registerStoreMock = vi.fn()
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: registerStoreMock }
})

describe('useCardStore', () => {
    beforeEach(async () => {
        const { useCardStore } = await import('../ux-store')
        useCardStore.getState().resetState()
    })

    test('setOnboardingStep updates the onboarding cursor', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => result.current.setOnboardingStep(OnboardingStep.Address))

        expect(result.current.onboardingStep).toBe(OnboardingStep.Address)
    })

    test('stores the onboarding contact inputs', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setEmail('john@example.com')
            result.current.setCountryIso('GB')
            result.current.setVerificationCode('PERA123')
        })

        expect(result.current.email).toBe('john@example.com')
        expect(result.current.countryIso).toBe('GB')
        expect(result.current.verificationCode).toBe('PERA123')
    })

    test('resetState clears the onboarding contact inputs', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setEmail('john@example.com')
            result.current.setCountryIso('GB')
            result.current.setVerificationCode('PERA123')
        })
        act(() => result.current.resetState())

        expect(result.current.email).toBeNull()
        expect(result.current.countryIso).toBeNull()
        expect(result.current.verificationCode).toBeNull()
    })

    test('setCardSnapshot stores the non-sensitive card hint', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() =>
            result.current.setCardSnapshot({
                cardId: 'card_1',
                status: CardStatus.Active,
                panLast4: '1234',
            }),
        )

        expect(result.current.cardId).toBe('card_1')
        expect(result.current.lastKnownStatus).toBe(CardStatus.Active)
        expect(result.current.lastKnownPanLast4).toBe('1234')
    })

    test('resetState restores the initial defaults', async () => {
        const { useCardStore } = await import('../ux-store')
        const { result } = renderHook(() => useCardStore())

        act(() => {
            result.current.setOnboardingStep(OnboardingStep.Address)
            result.current.setTransactionFilters({ searchKey: 'coffee' })
        })
        act(() => result.current.resetState())

        expect(result.current.onboardingStep).toBe(OnboardingStep.EmailSend)
        expect(result.current.transactionFilters).toEqual({})
        expect(result.current.cardId).toBeNull()
    })

    test('registers clearStorage and resetState under card-store', async () => {
        await import('../ux-store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('card-store')
    })
})
