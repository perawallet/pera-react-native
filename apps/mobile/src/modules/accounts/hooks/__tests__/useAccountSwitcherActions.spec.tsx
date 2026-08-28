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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAccountSwitcherActions } from '../useAccountSwitcherActions'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    requestSheet: vi.fn((_request: { options?: unknown }) =>
        Promise.resolve(undefined),
    ),
    hasCardSession: vi.fn(() => true),
    cardState: {
        escrowCardAddress: 'ESCROW' as string | null,
        escrowCardApproved: true as boolean,
    },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestSheet }),
}))

vi.mock('@perawallet/wallet-core-card', () => ({
    hasCardSession: () => mocks.hasCardSession(),
    useCardStore: { getState: () => mocks.cardState },
}))

vi.mock('@modules/accounts/components/AccountSortContent', () => ({
    AccountSortContent: () => null,
}))

describe('useAccountSwitcherActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.hasCardSession.mockReturnValue(true)
        mocks.cardState.escrowCardAddress = 'ESCROW'
        mocks.cardState.escrowCardApproved = true
    })

    it('routes add-account into the onboarding stack', () => {
        const { result } = renderHook(() => useAccountSwitcherActions())

        act(() => result.current.goToAddAccount())

        expect(mocks.navigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'AddAccountHome',
        })
    })

    it('sends a stale auth flag to sign-in rather than the card', () => {
        mocks.hasCardSession.mockReturnValue(false)
        const { result } = renderHook(() => useAccountSwitcherActions())

        act(() => result.current.openPeraCard())

        expect(mocks.navigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardSignIn',
        })
    })

    it('sends an authenticated user with no approved card back to onboarding', () => {
        mocks.cardState.escrowCardApproved = false
        const { result } = renderHook(() => useAccountSwitcherActions())

        act(() => result.current.openPeraCard())

        expect(mocks.navigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'CardOnboarding',
            params: { screen: 'CardOnboardingStatus', params: {} },
        })
    })

    it('opens the card dashboard once session and approval both hold', () => {
        const { result } = renderHook(() => useAccountSwitcherActions())

        act(() => result.current.openPeraCard())

        expect(mocks.navigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'PeraCardAccount' },
        })
    })

    it('opens the sort sheet as a modal that cannot be panned away', async () => {
        const { result } = renderHook(() => useAccountSwitcherActions())

        await act(async () => {
            await result.current.openSort()
        })

        expect(mocks.requestSheet).toHaveBeenCalledTimes(1)
        expect(mocks.requestSheet.mock.calls[0][0]).toMatchObject({
            options: { size: 'modal', enablePanDownToClose: false },
        })
    })
})
