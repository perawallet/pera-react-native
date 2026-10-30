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
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountFundedNetworksQuery } from '../useAccountFundedNetworksQuery'

import type { WalletAccount } from '../../models'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const accountOn = (chains: WalletAccount['chains']): WalletAccount => ({
    id: 'account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains,
})

const ALGORAND_ONLY = accountOn({
    algorand: { address: 'ADDR1', keyPairId: 'kp' },
})

const UNIVERSAL = accountOn({
    algorand: { address: 'ADDR1', keyPairId: 'kp' },
    ethereum: { address: '0xabc', keyPairId: 'kp' },
    base: { address: '0xabc', keyPairId: 'kp' },
})

const mockGetAccountFundedNetworks = vi.fn()
vi.mock('../../db', () => ({
    getAccountFundedNetworks: (...args: unknown[]) =>
        mockGetAccountFundedNetworks(...args),
}))

const mockEnsureAccountFetched = vi.fn(() => Promise.resolve())
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: (...args: unknown[]) =>
        mockEnsureAccountFetched(...(args as [])),
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountFundedNetworksQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('reads funding across every network, not only the selected one', async () => {
        mockGetAccountFundedNetworks.mockResolvedValue(['algorand/testnet'])

        const { result } = renderHook(
            () => useAccountFundedNetworksQuery(ALGORAND_ONLY, SCOPE),
            { wrapper: wrapper() },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.isFunded).toBe(true)
        expect(result.current.fundedNetworks).toEqual(['algorand/testnet'])
        expect(mockGetAccountFundedNetworks).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            chainId: 'algorand',
        })
        // Only the selected network can be force-fetched; the rest are whatever
        // earlier syncs persisted.
        expect(mockEnsureAccountFetched).toHaveBeenCalledWith('ADDR1', SCOPE)
    })

    it('counts a balance held only on another chain of the account', async () => {
        mockGetAccountFundedNetworks.mockImplementation(
            ({ chainId }: { chainId: string }) =>
                Promise.resolve(chainId === 'base' ? ['base/mainnet'] : []),
        )

        const { result } = renderHook(
            () => useAccountFundedNetworksQuery(UNIVERSAL, SCOPE),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.isFunded).toBe(true)
        expect(result.current.fundedNetworks).toEqual(['base/mainnet'])
        // Ethereum and Base share an address, so each chain is read on its own.
        expect(mockGetAccountFundedNetworks).toHaveBeenCalledWith({
            accountAddress: '0xabc',
            chainId: 'ethereum',
        })
        expect(mockGetAccountFundedNetworks).toHaveBeenCalledWith({
            accountAddress: '0xabc',
            chainId: 'base',
        })
        expect(mockEnsureAccountFetched).toHaveBeenCalledTimes(1)
        expect(mockEnsureAccountFetched).toHaveBeenCalledWith('ADDR1', SCOPE)
    })

    it('serves from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        mockGetAccountFundedNetworks.mockResolvedValue([])

        const { result } = renderHook(
            () => useAccountFundedNetworksQuery(ALGORAND_ONLY, SCOPE),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.isFunded).toBe(false)
    })

    it('does not query without an account', () => {
        const { result } = renderHook(
            () => useAccountFundedNetworksQuery(undefined, SCOPE),
            { wrapper: wrapper() },
        )

        expect(result.current.isFunded).toBe(false)
        expect(result.current.isPending).toBe(false)
        expect(mockGetAccountFundedNetworks).not.toHaveBeenCalled()
    })
})
