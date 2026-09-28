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

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const mocks = vi.hoisted(() => ({
    escrowCardOwner: null as string | null,
    getPendingWithdrawal: vi.fn(),
    getWaitTimeSeconds: vi.fn(),
}))
vi.mock('../../store', () => ({
    useCardStore: (
        selector: (state: { escrowCardOwner: string | null }) => unknown,
    ) => selector({ escrowCardOwner: mocks.escrowCardOwner }),
}))
vi.mock('../useEscrowWithdrawal', () => ({
    useEscrowWithdrawal: () => ({
        getPendingWithdrawal: mocks.getPendingWithdrawal,
        getWaitTimeSeconds: mocks.getWaitTimeSeconds,
    }),
}))

import { useCardPendingWithdrawalQuery } from '../useCardPendingWithdrawalQuery'
import { CardEscrowNotConfiguredError } from '../../api/escrow'

const PENDING = {
    card: 'CARD',
    recipient: 'OWNER',
    asset: '10458941',
    amount: 100_000n,
    createdAt: 1_700_000_000,
    nonce: 0n,
}

describe('useCardPendingWithdrawalQuery', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        mocks.escrowCardOwner = 'OWNER'
        mocks.getPendingWithdrawal.mockResolvedValue(PENDING)
        mocks.getWaitTimeSeconds.mockResolvedValue(20)
    })

    it('reads the pending request and the wait time for the stored owner', async () => {
        const { result } = renderHook(() => useCardPendingWithdrawalQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.pending).not.toBeNull())
        expect(result.current.pending).toEqual(PENDING)
        expect(result.current.waitTimeSeconds).toBe(20)
        expect(mocks.getPendingWithdrawal).toHaveBeenCalledWith('OWNER')
    })

    it('stays idle with no owner to look up', async () => {
        mocks.escrowCardOwner = null

        const { result } = renderHook(() => useCardPendingWithdrawalQuery(), {
            wrapper,
        })

        await new Promise(resolve => setTimeout(resolve, 10))
        expect(mocks.getPendingWithdrawal).not.toHaveBeenCalled()
        expect(result.current.pending).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })

    // A build without chain ids has no contract to ask, which is not an
    // error state the overview should surface.
    it('reads an unconfigured escrow as nothing pending', async () => {
        mocks.getPendingWithdrawal.mockRejectedValue(
            new CardEscrowNotConfiguredError(),
        )

        const { result } = renderHook(() => useCardPendingWithdrawalQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.pending).toBeNull()
        expect(result.current.waitTimeSeconds).toBeNull()
    })
})
