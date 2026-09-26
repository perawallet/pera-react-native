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
import {
    CardAccountLinkedElsewhereError,
    FundingType,
} from '@perawallet/wallet-core-card'
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
    // Records the options too, so a test can prove the screen relies on the
    // shared handler's copy resolution instead of passing its own keys.
    useCardErrorToast:
        (options?: unknown) =>
        (error: unknown): Promise<void> =>
            mockShowCardError(error, options) as Promise<void>,
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

    it('shows a single step for a Manual flow', () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        expect(result.current.steps.map(step => step.id)).toEqual([
            'signCreate',
        ])
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('active')
    })

    it('signs, creates and finishes a Manual card in one step', async () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(mockRequirePin).toHaveBeenCalled()
        expect(mockSignOwnership).toHaveBeenCalledWith(CONNECTED_ACCOUNT)
        expect(mockCreateAndApprove).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            PROOF,
        )
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('done')
        expect(result.current.isComplete).toBe(true)
    })

    it('shows two steps for an Auto flow', () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())

        expect(result.current.steps.map(step => step.id)).toEqual([
            'signCreate',
            'autoFunding',
        ])
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('active')
        expect(stepStatus(result.current.steps, 'autoFunding')).toBe('pending')
    })

    // The regression this step model exists for: one signature must not tick
    // off the Auto Funding step the user has not been asked about yet.
    it('leaves Auto Funding waiting after the ownership signature', async () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(stepStatus(result.current.steps, 'signCreate')).toBe('done')
        expect(stepStatus(result.current.steps, 'autoFunding')).toBe('active')
        expect(result.current.isComplete).toBe(false)
        expect(mockFinish).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('needs a second tap to reach the Auto Funding approval screen', async () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)
        act(() => {
            result.current.onProceed()
        })

        expect(mockNavigate).toHaveBeenCalledWith(
            'CardOnboardingAutoFundingSigning',
        )
        // The second tap only navigates: no re-sign, no second card.
        expect(mockSignOwnership).toHaveBeenCalledTimes(1)
        expect(mockCreateAndApprove).toHaveBeenCalledTimes(1)
    })

    it('goes back without signing when the PIN is declined', async () => {
        mockRequirePin.mockResolvedValue(false)
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(mockGoBack).toHaveBeenCalled()
        expect(mockSignOwnership).not.toHaveBeenCalled()
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('active')
    })

    it('keeps the step active and retryable when creation fails', async () => {
        const error = new CardAccountLinkedElsewhereError('linked elsewhere')
        mockCreateAndApprove.mockRejectedValueOnce(error)
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)

        expect(mockShowCardError).toHaveBeenCalledWith(error, undefined)
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('active')
        expect(result.current.isComplete).toBe(false)
        expect(mockFinish).not.toHaveBeenCalled()

        await proceed(result)

        expect(mockCreateAndApprove).toHaveBeenCalledTimes(2)
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
    })

    it('marks the running step busy while the signature is in flight', async () => {
        let releaseSign: (value: typeof PROOF) => void = () => {}
        mockSignOwnership.mockReturnValueOnce(
            new Promise<typeof PROOF>(resolve => {
                releaseSign = resolve
            }),
        )
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => {
            result.current.onProceed()
        })
        await waitFor(() =>
            expect(
                result.current.steps.find(step => step.id === 'signCreate')
                    ?.isBusy,
            ).toBe(true),
        )

        act(() => {
            releaseSign(PROOF)
        })
        await waitFor(() => expect(result.current.isProceeding).toBe(false))
        expect(stepStatus(result.current.steps, 'signCreate')).toBe('done')
    })

    it('ignores a tap once every step has run', async () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        await proceed(result)
        act(() => {
            result.current.onProceed()
        })

        expect(mockSignOwnership).toHaveBeenCalledTimes(1)
    })
})
