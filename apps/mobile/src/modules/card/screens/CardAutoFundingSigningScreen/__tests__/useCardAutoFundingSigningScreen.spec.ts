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

const {
    cardStoreState,
    accountsState,
    mockEnableAutoDraw,
    mockFinish,
    mockShowCardError,
} = vi.hoisted(() => ({
    cardStoreState: {
        connectedFundingSourceAddress: 'ADDR1' as string | null,
        escrowCardAddress: 'CARD1' as string | null,
    },
    accountsState: { accounts: [] as WalletAccount[] },
    mockEnableAutoDraw: vi.fn(),
    mockFinish: vi.fn(),
    mockShowCardError: vi.fn(),
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
    useAutoDrawSwitch: () => ({
        enableAutoDraw: mockEnableAutoDraw,
    }),
    useFinishCardCreation: () => ({ finish: mockFinish }),
    useCardErrorToast: () => mockShowCardError,
}))

import { useCardAutoFundingSigningScreen } from '../useCardAutoFundingSigningScreen'

const CONNECTED_ACCOUNT: WalletAccount = {
    id: 'a1',
    type: 'algo25',
    address: 'ADDR1',
    keyPairId: 'kp1',
} as WalletAccount

describe('useCardAutoFundingSigningScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        cardStoreState.connectedFundingSourceAddress = 'ADDR1'
        cardStoreState.escrowCardAddress = 'CARD1'
        accountsState.accounts = [CONNECTED_ACCOUNT]
        mockEnableAutoDraw.mockResolvedValue(undefined)
    })

    it('approves: registers the LSig + enables on-chain, then finishes with Auto funding', async () => {
        const { result } = renderHook(() => useCardAutoFundingSigningScreen())

        act(() => {
            result.current.handleApprove()
        })

        await waitFor(() => expect(mockFinish).toHaveBeenCalled())
        expect(mockEnableAutoDraw).toHaveBeenCalledWith(
            CONNECTED_ACCOUNT,
            'CARD1',
        )
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Auto, false)
    })

    it('surfaces a failure and lets the user retry', async () => {
        mockEnableAutoDraw.mockRejectedValueOnce(new Error('sign boom'))
        const { result } = renderHook(() => useCardAutoFundingSigningScreen())

        act(() => {
            result.current.handleApprove()
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.error?.message).toBe('sign boom')
        expect(mockShowCardError).toHaveBeenCalled()
        expect(mockFinish).not.toHaveBeenCalled()

        mockEnableAutoDraw.mockResolvedValue(undefined)
        act(() => {
            result.current.handleApprove()
        })
        await waitFor(() => expect(mockFinish).toHaveBeenCalled())
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Auto, false)
    })

    it('surfaces an error and resets pending state when required data is missing, instead of silently doing nothing', async () => {
        cardStoreState.escrowCardAddress = null
        const { result } = renderHook(() => useCardAutoFundingSigningScreen())

        act(() => {
            result.current.handleApprove()
        })

        await waitFor(() => expect(result.current.error).not.toBeNull())
        expect(result.current.isPending).toBe(false)
        expect(mockShowCardError).toHaveBeenCalled()
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockFinish).not.toHaveBeenCalled()
    })

    it('rejects: degrades to Manual funding without calling enableAutoDraw', () => {
        const { result } = renderHook(() => useCardAutoFundingSigningScreen())

        act(() => {
            result.current.handleReject()
        })

        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockFinish).toHaveBeenCalledWith(FundingType.Manual, true)
    })
})
