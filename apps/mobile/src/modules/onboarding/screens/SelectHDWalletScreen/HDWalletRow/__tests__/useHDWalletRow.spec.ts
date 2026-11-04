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

import { renderHook } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { HdSeedGroup } from '@perawallet/wallet-core-accounts'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useHDWalletRow } from '../useHDWalletRow'

const ALGO_A = 'A'.repeat(58)
const ALGO_B = 'B'.repeat(58)
const ETH_B = `0x${'b'.repeat(40)}`

const mockTotalsQuery = vi.fn()
const mockResult = {
    current: {
        accountValueTotals: new Map<string, unknown>(),
        fiatTotalSources: [] as unknown[],
    },
}
const mockRegistered = { current: ['algorand', 'ethereum', 'base'] }
const mockIsMultichain = { current: true }

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountValueTotalsQuery: (...args: unknown[]) => {
            mockTotalsQuery(...args)
            return mockResult.current
        },
        useRegisteredChainIds: () => mockRegistered.current,
    }
})

vi.mock('@modules/accounts', () => ({
    useIsMultichain: () => mockIsMultichain.current,
}))

vi.mock('@hooks/useHomeChainScope', () => ({
    useHomeChainScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: (value: Decimal | null | undefined) =>
            value ? value.times(2) : null,
    }),
}))

const accountA = {
    id: 'a',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: ALGO_A, keyPairId: 'k' } },
}
const accountB = {
    id: 'b',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 1 } },
    chains: {
        algorand: { address: ALGO_B, keyPairId: 'k' },
        ethereum: { address: ETH_B, keyPairId: 'k' },
    },
}
const group = {
    seedKeyId: 'seed',
    accounts: [accountA, accountB],
    firstAccount: accountA,
    accountCount: 2,
} as unknown as HdSeedGroup

const source = (chainId: string, address: string) => ({
    address,
    scope: { chainId, networkId: 'mainnet' },
})
const value = (fiat: number | null, isPending = false) => ({
    nativeValue: new Decimal(0),
    fiatValue: fiat === null ? null : new Decimal(fiat),
    isPending,
})

describe('useHDWalletRow', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        mockRegistered.current = ['algorand', 'ethereum', 'base']
        mockIsMultichain.current = true
        mockResult.current = {
            accountValueTotals: new Map([
                [`algorand|${ALGO_A}`, value(1)],
                [`algorand|${ALGO_B}`, value(2)],
                [`ethereum|${ETH_B}`, value(10)],
            ]),
            fiatTotalSources: [
                source('algorand', ALGO_A),
                source('algorand', ALGO_B),
                source('ethereum', ETH_B),
            ],
        }
    })

    it('reads the totals of every account in the wallet on the home scope', () => {
        renderHook(() => useHDWalletRow(group))

        expect(mockTotalsQuery).toHaveBeenCalledWith(group.accounts, {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })

    it('sums the wallet across accounts and networks, in the preferred currency', () => {
        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.hasFiatTotal).toBe(true)
        expect(result.current.fiatTotal?.toString()).toBe('26')
    })

    it('is unknown when a counted value has no price', () => {
        mockResult.current.accountValueTotals.set(
            `ethereum|${ETH_B}`,
            value(null),
        )

        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.hasFiatTotal).toBe(true)
        expect(result.current.fiatTotal).toBeNull()
    })

    it('is undefined while a value is still loading', () => {
        mockResult.current.accountValueTotals.set(
            `ethereum|${ETH_B}`,
            value(0, true),
        )

        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.hasFiatTotal).toBe(true)
        expect(result.current.fiatTotal).toBeUndefined()
    })

    it('has no fiat total when nothing counts toward it', () => {
        mockResult.current = {
            accountValueTotals: new Map(),
            fiatTotalSources: [],
        }

        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.hasFiatTotal).toBe(false)
        expect(result.current.fiatTotal).toBeUndefined()
    })

    it('lists the registered chains the wallet has addresses on, in registry order', () => {
        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.chainIds).toEqual(['algorand', 'ethereum'])
    })

    it('passes whether more than one chain is registered through', () => {
        mockIsMultichain.current = false

        const { result } = renderHook(() => useHDWalletRow(group))

        expect(result.current.isMultichain).toBe(false)
    })
})
