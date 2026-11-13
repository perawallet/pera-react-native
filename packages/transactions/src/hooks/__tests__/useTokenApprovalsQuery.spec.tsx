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

// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TokenApproval } from '@perawallet/wallet-core-chain-contract'
import {
    transferChainAdapters,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useTokenApprovalsQuery } from '../useTokenApprovalsQuery'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ACCOUNT = '0x00000000000000000000000000000000000000aa'

const APPROVAL: TokenApproval = {
    kind: 'allowance',
    assetRef: { chainId: 'ethereum', assetId: '0xUSDC' },
    spender: '0x00000000000000000000000000000000000000bb',
}

const listApprovals =
    vi.fn<NonNullable<TransferChainAdapter['listApprovals']>>()

const registerAdapter = (withApprovals: boolean) => {
    transferChainAdapters.reset()
    transferChainAdapters.register({
        chainId: SCOPE.chainId,
        build: vi.fn(),
        getFeeEstimate: vi.fn(),
        spendableBalance: vi.fn(),
        ...(withApprovals && { listApprovals }),
    })
}

const renderQuery = (account: string | undefined = ACCOUNT) => {
    const queryClient = new QueryClient()
    return renderHook(() => useTokenApprovalsQuery({ scope: SCOPE, account }), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

describe('useTokenApprovalsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAdapter(true)
    })

    it("returns the adapter's approvals for the account", async () => {
        listApprovals.mockResolvedValue([APPROVAL])

        const { result } = renderQuery()

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toEqual([APPROVAL])
        expect(listApprovals).toHaveBeenCalledWith(ACCOUNT, SCOPE)
    })

    it('reads the chain again every time the list is opened', async () => {
        listApprovals.mockResolvedValue([APPROVAL])
        const queryClient = new QueryClient()
        const wrap = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
        const first = renderHook(
            () => useTokenApprovalsQuery({ scope: SCOPE, account: ACCOUNT }),
            { wrapper: wrap },
        )
        await waitFor(() => expect(first.result.current.isPending).toBe(false))
        first.unmount()

        const second = renderHook(
            () => useTokenApprovalsQuery({ scope: SCOPE, account: ACCOUNT }),
            { wrapper: wrap },
        )
        await waitFor(() => expect(listApprovals).toHaveBeenCalledTimes(2))
        second.unmount()
    })

    it('reads nothing, and is not pending, without an account', () => {
        const { result } = renderQuery('')

        expect(listApprovals).not.toHaveBeenCalled()
        expect(result.current).toMatchObject({ data: [], isPending: false })
    })

    it('reads nothing on a chain whose adapter lists no approvals', () => {
        registerAdapter(false)

        const { result } = renderQuery()

        expect(listApprovals).not.toHaveBeenCalled()
        expect(result.current).toMatchObject({ data: [], isPending: false })
    })

    it('reports a failed read and reads again on refetch', async () => {
        listApprovals.mockRejectedValueOnce(new Error('rpc down'))
        listApprovals.mockResolvedValueOnce([APPROVAL])

        const { result } = renderQuery()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.data).toEqual([])

        result.current.refetch()

        await waitFor(() => expect(result.current.data).toEqual([APPROVAL]))
        expect(result.current.isError).toBe(false)
    })
})
