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
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'
import { useCardStore } from '../../store'
import { useCardAutoDraw } from '../useCardAutoDraw'
import { cardQueryKeys } from '../querykeys'

const SCOPES: ChainScope[] = [
    { chainId: 'algorand', networkId: 'testnet' } as const,
    { chainId: 'ethereum', networkId: 'sepolia' },
]
const account = { address: 'FUNDING' } as WalletAccount

const enableAutoDraw = vi.fn(async () => undefined)
const disableAutoDraw = vi.fn(async () => undefined)

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe.each(SCOPES)('useCardAutoDraw ($chainId)', SCOPE => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient()
        useCardStore.getState().setConnectedFundingSourceAddress('FUNDING')
        registerFakeCardAdapter({
            chainId: SCOPE.chainId,
            autoDraw: { enableAutoDraw, disableAutoDraw },
        })
    })

    it('records the confirmed switch instead of re-reading a chain that may lag', async () => {
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const key = cardQueryKeys.autoDrawEnabled(SCOPE, 'FUNDING')
        const { result } = renderHook(() => useCardAutoDraw(SCOPE), { wrapper })

        await result.current.enableAutoDraw(account, 'CARD')
        expect(queryClient.getQueryData(key)).toBe(true)

        await result.current.disableAutoDraw(account)
        expect(queryClient.getQueryData(key)).toBe(false)

        expect(invalidate).not.toHaveBeenCalled()
    })

    it('leaves the cached switch alone when the change fails', async () => {
        enableAutoDraw.mockRejectedValueOnce(new Error('enable failed'))
        const key = cardQueryKeys.autoDrawEnabled(SCOPE, 'FUNDING')
        queryClient.setQueryData(key, false)
        const { result } = renderHook(() => useCardAutoDraw(SCOPE), { wrapper })

        await expect(
            result.current.enableAutoDraw(account, 'CARD'),
        ).rejects.toThrow('enable failed')

        expect(queryClient.getQueryData(key)).toBe(false)
    })

    it('forwards the account, card address and scope when enabling', async () => {
        const { result } = renderHook(() => useCardAutoDraw(SCOPE), { wrapper })

        await result.current.enableAutoDraw(account, 'CARD')

        expect(enableAutoDraw).toHaveBeenCalledWith(account, 'CARD', SCOPE)
    })

    it('forwards the account and scope when disabling', async () => {
        const { result } = renderHook(() => useCardAutoDraw(SCOPE), { wrapper })

        await result.current.disableAutoDraw(account)

        expect(disableAutoDraw).toHaveBeenCalledWith(account, SCOPE)
    })

    it("propagates the adapter's rejection", async () => {
        enableAutoDraw.mockRejectedValueOnce(new Error('enable failed'))
        disableAutoDraw.mockRejectedValueOnce(new Error('disable failed'))
        const { result } = renderHook(() => useCardAutoDraw(SCOPE), { wrapper })

        await expect(
            result.current.enableAutoDraw(account, 'CARD'),
        ).rejects.toThrow('enable failed')
        await expect(result.current.disableAutoDraw(account)).rejects.toThrow(
            'disable failed',
        )
    })
})
