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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useAssetsQuery,
    useAssetPricesQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useImpactTransactions } from '@perawallet/wallet-core-signing'
import { useBalanceImpactSummary } from '../useBalanceImpactSummary'

// Keep computeBalanceImpact real; only stub the data-source hook.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useImpactTransactions: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
}))

const USER = 'USER_ADDRESS'
const OTHER = 'OTHER_ADDRESS'

const NFT: PeraAsset = {
    assetId: '100',
    name: 'Cool NFT',
    decimals: 0,
    creator: { address: '' },
    totalSupply: new Decimal(1),
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        type: 'collectible',
        collectible: {
            title: 'Cool NFT #1',
            collection: { name: 'Cool Collection' },
        },
    },
}

const spendAlgo = {
    sender: USER,
    fee: 1000n,
    paymentTransaction: { amount: 1_000_000n, receiver: OTHER },
} as unknown as PeraDisplayableTransaction

const receiveNft = {
    sender: OTHER,
    fee: 1000n,
    assetTransferTransaction: {
        assetId: 100n,
        amount: 1n,
        receiver: USER,
    },
} as unknown as PeraDisplayableTransaction

// Close-remainder with no explicit transfer: sweeps the whole ALGO balance but
// produces no delta on its own.
const closeAlgo = {
    sender: USER,
    fee: 1000n,
    paymentTransaction: {
        amount: 0n,
        receiver: OTHER,
        closeRemainderTo: OTHER,
    },
} as unknown as PeraDisplayableTransaction

const mint = (
    unitName: string,
    total: bigint,
    assetId = 0n,
): PeraDisplayableTransaction =>
    ({
        sender: USER,
        fee: 1000n,
        assetConfigTransaction: {
            assetId,
            params: { name: `${unitName} asset`, unitName, total, decimals: 0 },
        },
    }) as unknown as PeraDisplayableTransaction

const mockTransactions = (
    transactions: PeraDisplayableTransaction[],
    isSimulating = false,
    simulationFailed = false,
) => {
    vi.mocked(useImpactTransactions).mockReturnValue({
        transactions,
        signableAddresses: new Set([USER]),
        isSimulating,
        simulationFailed,
    })
}

beforeEach(() => {
    vi.mocked(useAssetsQuery).mockReturnValue({
        data: new Map([['100', NFT]]),
        isPending: false,
        isFetched: true,
        isRefetching: false,
        isError: false,
    })
    vi.mocked(useAssetPricesQuery).mockReturnValue({
        data: new Map(),
        isPending: false,
        isFetched: true,
        isRefetching: false,
        isError: false,
        isPaused: false,
    })
})

describe('useBalanceImpactSummary', () => {
    it('splits movements into spend and receive sections', () => {
        mockTransactions([spendAlgo, receiveNft])

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.hasImpact).toBe(true)
        expect(result.current.spend).toHaveLength(1)
        expect(result.current.receive).toHaveLength(1)
    })

    it('exposes the outgoing ALGO movement with its asset, amount and direction', () => {
        mockTransactions([spendAlgo])

        const { result } = renderHook(() => useBalanceImpactSummary())

        const algo = result.current.spend[0]
        expect(algo.assetId).toBe('0')
        expect(algo.direction).toBe('spend')
        expect(algo.isCollectible).toBe(false)
        expect(algo.amount.toString()).toBe('1')
        expect(algo.asset.unitName).toBe('ALGO')
    })

    it('flags a collectible and exposes its title and collection', () => {
        mockTransactions([receiveNft])

        const { result } = renderHook(() => useBalanceImpactSummary())

        const nft = result.current.receive[0]
        expect(nft.isCollectible).toBe(true)
        expect(nft.collectibleTitle).toBe('Cool NFT #1')
        expect(nft.collectibleSubtitle).toBe('Cool Collection · 100')
    })

    it('passes through the simulation-in-progress flag', () => {
        mockTransactions([spendAlgo], true)

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.isSimulating).toBe(true)
    })

    it('passes through the simulation-failed flag', () => {
        mockTransactions([spendAlgo], false, true)

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.simulationFailed).toBe(true)
    })

    it('surfaces a close-remainder sweep as a full-balance spend row', () => {
        mockTransactions([closeAlgo])

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.spend).toHaveLength(1)
        const algo = result.current.spend[0]
        expect(algo.assetId).toBe('0')
        expect(algo.isFullBalance).toBe(true)
    })

    it('surfaces every asset a multi-mint group creates as a receive row', () => {
        mockTransactions([mint('MINT1', 1n), mint('MINT2', 5n)])

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.hasImpact).toBe(true)
        expect(result.current.spend).toHaveLength(0)
        expect(
            result.current.receive.map(item => [
                item.asset.unitName,
                item.amount.toString(),
                item.isNewAsset,
            ]),
        ).toEqual([
            ['MINT2', '5', true],
            ['MINT1', '1', true],
        ])
    })

    it('ignores a reconfigure of an existing asset', () => {
        mockTransactions([mint('MINT1', 1n, 31_566_704n)])

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.hasImpact).toBe(false)
    })

    it('reports no impact when nothing touches the user’s accounts', () => {
        mockTransactions([
            {
                sender: OTHER,
                fee: 1000n,
                paymentTransaction: { amount: 5n, receiver: OTHER },
            } as unknown as PeraDisplayableTransaction,
        ])

        const { result } = renderHook(() => useBalanceImpactSummary())

        expect(result.current.hasImpact).toBe(false)
    })
})
