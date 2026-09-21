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
import {
    AutoDrawProgramUnverifiedError,
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
    mockEnableAutoDraw,
    mockFinish,
    mockShowCardError,
    mockRequirePin,
    mockNavigate,
    mockGoBack,
    routeState,
} = vi.hoisted(() => ({
    cardStoreState: {
        connectedFundingSourceAddress: 'ADDR1' as string | null,
        escrowCardAddress: null as string | null,
    },
    accountsState: { accounts: [] as WalletAccount[] },
    mockSignOwnership: vi.fn(),
    mockCreateAndApprove: vi.fn(),
    mockEnableAutoDraw: vi.fn(),
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
    useAutoDrawSwitch: () => ({ enableAutoDraw: mockEnableAutoDraw }),
    useFinishCardCreation: () => ({ finish: mockFinish }),
    // Records the options too, so a test can prove which copy a failure used.
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

const AUTO_FUNDING_ERROR_KEYS = expect.objectContaining({
    titleKey: 'peraCard.signing.auto_funding_error_title',
})

describe('useCardCreateSigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        cardStoreState.connectedFundingSourceAddress = 'ADDR1'
        cardStoreState.escrowCardAddress = null
        accountsState.accounts = [CONNECTED_ACCOUNT]
        routeState.fundingType = FundingType.Manual
        mockRequirePin.mockResolvedValue(true)
        mockSignOwnership.mockResolvedValue(PROOF)
        mockCreateAndApprove.mockImplementation(async () => {
            cardStoreState.escrowCardAddress = 'ESCROW'
            return { cardAddress: 'ESCROW' }
        })
        mockEnableAutoDraw.mockResolvedValue(undefined)
        mockShowCardError.mockResolvedValue(undefined)
    })

    it('Manual: lists two steps with the first one up next', () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        expect(result.current.steps.map(step => step.id)).toEqual([
            'ownership',
            'create',
        ])
        expect(result.current.steps[0]?.status).toBe('active')
        expect(result.current.steps[1]?.status).toBe('pending')
        expect(result.current.isRunning).toBe(false)
        expect(result.current.isComplete).toBe(false)
    })

    it('Manual: one tap gates on PIN, signs, creates and finishes', async () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(mockRequirePin).toHaveBeenCalledTimes(1)
        expect(mockSignOwnership).toHaveBeenCalledWith(CONNECTED_ACCOUNT)
        expect(mockCreateAndApprove).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            PROOF,
        )
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
        expect(result.current.steps.every(step => step.status === 'done')).toBe(
            true,
        )
    })

    it('declining the PIN gate goes back without signing', async () => {
        mockRequirePin.mockResolvedValue(false)
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
        expect(mockSignOwnership).not.toHaveBeenCalled()
        expect(result.current.isRunning).toBe(false)
    })

    it('Auto: one tap runs the proof, the creation and Auto Funding, then finishes on Auto', async () => {
        routeState.fundingType = FundingType.Auto
        const { result } = renderHook(() => useCardCreateSigningScreen())
        expect(result.current.steps.map(step => step.id)).toEqual([
            'ownership',
            'create',
            'autoFunding',
        ])

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(mockRequirePin).toHaveBeenCalledTimes(1)
        expect(mockEnableAutoDraw).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            'ESCROW',
        )
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Auto, false)
    })

    it('Auto: a failed Auto Funding step keeps the card and offers Manual', async () => {
        routeState.fundingType = FundingType.Auto
        mockEnableAutoDraw.mockRejectedValueOnce(new Error('lsig post 500'))
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.hasFailed).toBe(true))
        expect(result.current.canContinueWithManual).toBe(true)
        expect(mockShowCardError).toHaveBeenCalledWith(
            expect.any(Error),
            AUTO_FUNDING_ERROR_KEYS,
        )
        expect(mockFinish).not.toHaveBeenCalled()

        act(() => result.current.onContinueWithManual())

        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, true)
        expect(result.current.isComplete).toBe(true)
    })

    it('Auto: retrying after an Auto Funding failure re-runs only that step', async () => {
        routeState.fundingType = FundingType.Auto
        mockEnableAutoDraw.mockRejectedValueOnce(new Error('lsig post 500'))
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())
        await waitFor(() => expect(result.current.hasFailed).toBe(true))

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(mockSignOwnership).toHaveBeenCalledTimes(1)
        expect(mockCreateAndApprove).toHaveBeenCalledTimes(1)
        expect(mockEnableAutoDraw).toHaveBeenCalledTimes(2)
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Auto, false)
    })

    it('Auto: an unverified AutoDraw program degrades to Manual instead of offering a retry', async () => {
        routeState.fundingType = FundingType.Auto
        mockEnableAutoDraw.mockRejectedValueOnce(
            new AutoDrawProgramUnverifiedError('testnet'),
        )
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, true)
        expect(mockShowCardError).not.toHaveBeenCalled()
    })

    it('a failed creation surfaces the shared toast and retries from the proof', async () => {
        mockCreateAndApprove.mockRejectedValueOnce(new Error('backend 500'))
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.hasFailed).toBe(true))
        expect(result.current.canContinueWithManual).toBe(false)
        expect(mockShowCardError).toHaveBeenCalledWith(
            expect.any(Error),
            undefined,
        )
        expect(result.current.steps[1]?.status).toBe('active')

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(mockSignOwnership).toHaveBeenCalledTimes(2)
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, false)
    })

    it('hands a linked-elsewhere failure to the shared toast as its typed error', async () => {
        const linkedElsewhere = new CardAccountLinkedElsewhereError()
        mockCreateAndApprove.mockRejectedValueOnce(linkedElsewhere)
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() =>
            expect(mockShowCardError).toHaveBeenCalledWith(
                linkedElsewhere,
                undefined,
            ),
        )
    })

    it('marks the working step busy so the row spinner follows the run', async () => {
        let resolveSign: (proof: typeof PROOF) => void = () => {}
        mockSignOwnership.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveSign = resolve
                }),
        )
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())

        await waitFor(() => expect(result.current.isRunning).toBe(true))
        expect(result.current.steps[0]?.isBusy).toBe(true)
        expect(result.current.steps[1]?.isBusy).toBe(false)

        act(() => resolveSign(PROOF))
        await waitFor(() => expect(result.current.isComplete).toBe(true))
    })

    it('after completion the button is a no-op so the finish window cannot re-prompt', async () => {
        const { result } = renderHook(() => useCardCreateSigningScreen())

        act(() => result.current.onCreate())
        await waitFor(() => expect(result.current.isComplete).toBe(true))

        act(() => result.current.onCreate())

        expect(mockRequirePin).toHaveBeenCalledTimes(1)
    })
})
