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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    isAuthenticated: true,
    fetchExternalWallets: vi.fn(),
}))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mocks.isAuthenticated }),
}))
vi.mock('../../api/delegation', async () => ({
    ...(await vi.importActual<object>('../../api/delegation')),
    fetchExternalWallets: mocks.fetchExternalWallets,
}))

import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'
import { useCardOwnerAddressQuery } from '../useCardOwnerAddressQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const WALLETS = [{ address: 'CARD', network: 'algorand' }]

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
        client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
    >
        {children}
    </QueryClientProvider>
)

describe('useCardOwnerAddressQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isAuthenticated = true
        mocks.fetchExternalWallets.mockResolvedValue(WALLETS)
    })

    it('reads the owner of the card Baanx has on record from the chain', async () => {
        const adapter = registerFakeCardAdapter({
            findCardOwner: vi.fn(async () => 'OWNER'),
        })

        const { result } = renderHook(() => useCardOwnerAddressQuery(SCOPE), {
            wrapper,
        })

        await waitFor(() => expect(result.current.ownerAddress).toBe('OWNER'))
        expect(adapter.findCardOwner).toHaveBeenCalledWith(SCOPE, WALLETS)
    })

    it('stays empty when no card on this chain is on record', async () => {
        const adapter = registerFakeCardAdapter()

        const { result } = renderHook(() => useCardOwnerAddressQuery(SCOPE), {
            wrapper,
        })

        await waitFor(() => expect(adapter.findCardOwner).toHaveBeenCalled())
        expect(result.current.ownerAddress).toBeNull()
    })

    it('asks nothing without a card session', () => {
        mocks.isAuthenticated = false
        const adapter = registerFakeCardAdapter()

        const { result } = renderHook(() => useCardOwnerAddressQuery(SCOPE), {
            wrapper,
        })

        expect(result.current.ownerAddress).toBeNull()
        expect(mocks.fetchExternalWallets).not.toHaveBeenCalled()
        expect(adapter.findCardOwner).not.toHaveBeenCalled()
    })

    it('asks nothing while the caller holds it off', () => {
        registerFakeCardAdapter()

        renderHook(() => useCardOwnerAddressQuery(SCOPE, { enabled: false }), {
            wrapper,
        })

        expect(mocks.fetchExternalWallets).not.toHaveBeenCalled()
    })

    it('stays empty when Baanx cannot be reached', async () => {
        mocks.fetchExternalWallets.mockRejectedValue(new Error('offline'))
        const adapter = registerFakeCardAdapter()

        const { result } = renderHook(() => useCardOwnerAddressQuery(SCOPE), {
            wrapper,
        })

        await waitFor(() =>
            expect(mocks.fetchExternalWallets).toHaveBeenCalled(),
        )
        expect(result.current.ownerAddress).toBeNull()
        expect(adapter.findCardOwner).not.toHaveBeenCalled()
    })
})
