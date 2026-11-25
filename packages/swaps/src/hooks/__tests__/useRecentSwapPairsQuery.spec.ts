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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { SwapDistinctPairItem } from '../../models'
import { useRecentSwapPairsQuery } from '../useRecentSwapPairsQuery'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    payers: [] as unknown[],
    sourceChains: {} as Record<string, string[]>,
    history: vi.fn(),
}))

vi.mock('../useSwapScope', () => ({
    useSwapSigningAccounts: () =>
        Object.keys(mocks.sourceChains).map(id => ({ id })),
}))
vi.mock('../useSwapSourceChainsResolver', () => ({
    useSwapSourceChainsResolver: () => (account: { id: string }) =>
        mocks.sourceChains[account.id] ?? [],
}))
vi.mock('../useSwapAccountsAddresses', () => ({
    useSwapAccountsAddresses: () => mocks.payers,
}))
vi.mock('../useDistinctPairsHistoryQuery', () => ({
    useDistinctPairsHistoryQuery: mocks.history,
}))

const pairPaidBy = (address: string) =>
    ({
        assetIn: { assetId: 'in', ref: { ...ALGO, assetId: 'in' } },
        assetOut: { assetId: 'out', ref: { ...ALGO, assetId: 'out' } },
        sourceAccount: { scope: ALGO, address },
        swapDatetime: '2026-10-01T00:00:00Z',
        pairKey: address,
    }) as unknown as SwapDistinctPairItem

describe('swaps/useRecentSwapPairsQuery', () => {
    beforeEach(() => {
        mocks.sourceChains = { main: ['algorand'] }
        mocks.payers = [
            {
                scope: ALGO,
                address: 'MAIN',
                accountId: 'main',
                isOnDevice: true,
            },
        ]
        mocks.history.mockReset()
        mocks.history.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
        })
    })

    test('names every payer in the history read and tags each pair with its payer', () => {
        const paid = pairPaidBy('MAIN')
        mocks.history.mockReturnValue({
            data: [paid, pairPaidBy('STRANGER')],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useRecentSwapPairsQuery())

        expect(mocks.history).toHaveBeenCalledWith([
            { scope: ALGO, address: 'MAIN' },
        ])
        expect(result.current.isEnabled).toBe(true)
        expect(result.current.pairs).toEqual([{ ...paid, accountId: 'main' }])
    })

    test("counts the cap after leaving out pairs that are not the wallet's", () => {
        const strangers = Array.from({ length: 3 }, (_, i) =>
            pairPaidBy(`STRANGER${i}`),
        )
        const own = Array.from({ length: 12 }, () => pairPaidBy('MAIN'))
        mocks.history.mockReturnValue({
            data: [...strangers, ...own],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useRecentSwapPairsQuery())

        expect(result.current.pairs).toHaveLength(10)
        expect(result.current.pairs.every(p => p.accountId === 'main')).toBe(
            true,
        )
    })

    test('lists an Ethereum same-chain pair paid by an EVM payer first', () => {
        const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const
        mocks.sourceChains = { main: ['algorand'], evm: ['ethereum'] }
        mocks.payers = [
            ...mocks.payers,
            {
                scope: ETH,
                address: '0xEvm',
                accountId: 'evm',
                isOnDevice: true,
            },
        ]
        const ethPair = {
            ...pairPaidBy('0xevm'),
            assetIn: { assetId: 'usdc', ref: { ...ETH, assetId: 'usdc' } },
            assetOut: { assetId: 'eth', ref: { ...ETH, assetId: 'eth' } },
            sourceAccount: { scope: ETH, address: '0xevm' },
        } as unknown as SwapDistinctPairItem
        mocks.history.mockReturnValue({
            data: [ethPair, pairPaidBy('MAIN')],
            isLoading: false,
            isError: false,
        })

        const { result } = renderHook(() => useRecentSwapPairsQuery())

        expect(result.current.pairs.map(p => p.accountId)).toEqual([
            'evm',
            'main',
        ])
    })

    test('leaves out of the history read an address the device does not register', () => {
        const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const
        mocks.payers = [
            {
                scope: ALGO,
                address: 'MAIN',
                accountId: 'main',
                isOnDevice: true,
            },
            {
                scope: ETH,
                address: '0xETH',
                accountId: 'main',
                isOnDevice: false,
            },
        ]

        const { result } = renderHook(() => useRecentSwapPairsQuery())

        expect(mocks.history).toHaveBeenCalledWith([
            { scope: ALGO, address: 'MAIN' },
        ])
        expect(result.current.isEnabled).toBe(true)
    })

    test('is off when no account can sign a swap', () => {
        mocks.payers = []

        const { result } = renderHook(() => useRecentSwapPairsQuery())

        expect(mocks.history).toHaveBeenCalledWith([])
        expect(result.current.isEnabled).toBe(false)
    })
})
