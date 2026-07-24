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

import { renderHook, act } from '@test-utils/render'
import { waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const PROOF = {
    signData: { data: 'd', authenticatorData: 'a' },
    signature: 's',
}

const {
    cardStoreState,
    accountsState,
    mockSignOwnership,
    mockCreateAndApprove,
    mockFinish,
    mockShowCardError,
    mockRequirePin,
    mockNavigate,
    mockGoBack,
    routeState,
} = vi.hoisted(() => ({
    cardStoreState: { connectedFundingSourceAddress: 'ADDR1' as string | null },
    accountsState: { accounts: [] as WalletAccount[] },
    mockSignOwnership: vi.fn(),
    mockCreateAndApprove: vi.fn(),
    mockFinish: vi.fn(),
    mockShowCardError: vi.fn(),
    mockRequirePin: vi.fn(),
    mockNavigate: vi.fn(),
    mockGoBack: vi.fn(),
    routeState: { fundingType: 'manual' as string },
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (selector: (state: typeof cardStoreState) => unknown) =>
            selector(cardStoreState),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => accountsState.accounts,
}))

vi.mock('@modules/card/hooks', () => ({
    useEscrowCardCreation: () => ({
        signOwnership: mockSignOwnership,
        createAndApprove: mockCreateAndApprove,
    }),
    useFinishCardCreation: () => ({ finish: mockFinish }),
    useCardErrorToast: () => mockShowCardError,
}))

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePin,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useRoute: () => ({ params: routeState }),
}))

import { useCardCreateSigningScreen } from '../useCardCreateSigningScreen'

const CONNECTED_ACCOUNT: WalletAccount = {
    id: 'a1',
    type: 'algo25',
    address: 'ADDR1',
    keyPairId: 'kp1',
} as WalletAccount

const stepStatus = (
    steps: { id: string; status: string }[],
    id: string,
): string | undefined => steps.find(step => step.id === id)?.status

const proceed = async (result: {
    current: { onProceed: () => void; isProceeding: boolean }
}) => {
    act(() => {
        result.current.onProceed()
    })
    await waitFor(() => expect(result.current.isProceeding).toBe(false))
}

describe('useCardCreateSigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        cardStoreState.connectedFundingSourceAddress = 'ADDR1'
        accountsState.accounts = [CONNECTED_ACCOUNT]
        routeState.fundingType = FundingType.Manual
        mockRequirePin.mockResolvedValue(true)
        mockSignOwnership.mockResolvedValue(PROOF)
        mockCreateAndApprove.mockResolvedValue({ cardAddress: 'CARD1' })
    })

    it('starts with only the sign step active for a Manual flow', () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        expect(result.current.steps.map(s => s.id)).toEqual(['sign', 'create'])
        expect(stepStatus(result.current.steps, 'sign')).toBe('active')
        expect(stepStatus(result.current.steps, 'create')).toBe('pending')
    })

    it('Manual: one Proceed tap signs, then auto-runs create+approve, then finishes', async () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(mockRequirePin).toHaveBeenCalled()
        expect(mockSignOwnership).toHaveBeenCalledWith(CONNECTED_ACCOUNT)
        expect(mockCreateAndApprove).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            PROOF,
        )
        expect(stepStatus(result.current.steps, 'sign')).toBe('done')
        expect(stepStatus(result.current.steps, 'create')).toBe('done')
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('Manual: declining the PIN gate on the sign step goes back without signing', async () => {
        mockRequirePin.mockResolvedValue(false)
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(mockGoBack).toHaveBeenCalled()
        expect(mockSignOwnership).not.toHaveBeenCalled()
        expect(mockCreateAndApprove).not.toHaveBeenCalled()
    })

    it('Auto: one Proceed tap signs and auto-creates, landing on the authorize step', async () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())

        expect(result.current.steps.map(s => s.id)).toEqual([
            'sign',
            'create',
            'authorize',
        ])

        await proceed(result)

        expect(mockCreateAndApprove).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            PROOF,
        )
        expect(stepStatus(result.current.steps, 'sign')).toBe('done')
        expect(stepStatus(result.current.steps, 'create')).toBe('done')
        expect(stepStatus(result.current.steps, 'authorize')).toBe('active')
        expect(mockFinish).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('Auto: a second Proceed tap on the authorize step navigates to the LSig approval screen', async () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        act(() => {
            result.current.onProceed()
        })

        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingAutoFundingSigning',
        )
        expect(mockFinish).not.toHaveBeenCalled()
    })

    it('shows the card error toast and stays on the same step so Proceed can retry', async () => {
        mockSignOwnership.mockRejectedValueOnce(new Error('sign boom'))
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => {
            result.current.onProceed()
        })
        await waitFor(() => expect(mockShowCardError).toHaveBeenCalled())
        expect(stepStatus(result.current.steps, 'sign')).toBe('active')
        expect(mockCreateAndApprove).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()

        mockSignOwnership.mockResolvedValue(PROOF)
        await proceed(result)
        expect(stepStatus(result.current.steps, 'sign')).toBe('done')
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
    })

    it('Auto: retrying after the create step fails does not fake-advance to authorize', async () => {
        routeState.fundingType = FundingType.Auto
        mockCreateAndApprove.mockRejectedValueOnce(new Error('create boom'))
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(stepStatus(result.current.steps, 'sign')).toBe('done')
        expect(stepStatus(result.current.steps, 'create')).toBe('active')
        expect(stepStatus(result.current.steps, 'authorize')).toBe('pending')
        expect(mockShowCardError).toHaveBeenCalledTimes(1)
        expect(mockNavigate).not.toHaveBeenCalled()

        mockCreateAndApprove.mockRejectedValueOnce(
            new Error('create boom again'),
        )
        await proceed(result)

        expect(stepStatus(result.current.steps, 'sign')).toBe('done')
        expect(stepStatus(result.current.steps, 'create')).toBe('active')
        expect(stepStatus(result.current.steps, 'authorize')).toBe('pending')
        expect(mockShowCardError).toHaveBeenCalledTimes(2)
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
