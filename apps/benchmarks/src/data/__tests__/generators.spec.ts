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

import { isValidAddress } from 'algosdk'
import { describe, expect, it, vi } from 'vitest'
import {
    algorandAddress,
    assetsHeldBy,
    benchAssets,
    benchHoldings,
    benchTransactions,
    benchWatchAccounts,
    evmAddress,
} from '../generators'

// The real encoder is chain-algorand's; the test stands algosdk in for it.
vi.mock('../addresses', async () => ({
    encodeAlgorandAddress: (await import('algosdk')).encodeAddress,
}))

describe('algorandAddress', () => {
    it('is valid, unique and the same every time over 10,000 indexes', () => {
        const first = Array.from({ length: 10_000 }, (_, i) =>
            algorandAddress(i),
        )
        const again = Array.from({ length: 10_000 }, (_, i) =>
            algorandAddress(i),
        )

        expect(first).toEqual(again)
        expect(new Set(first).size).toBe(10_000)
        expect(first.every(address => isValidAddress(address))).toBe(true)
    })
})

describe('evmAddress', () => {
    it('is a unique 20-byte hex address per index', () => {
        const addresses = Array.from({ length: 1000 }, (_, i) => evmAddress(i))

        expect(new Set(addresses).size).toBe(1000)
        expect(addresses.every(a => /^0x[0-9a-f]{40}$/.test(a))).toBe(true)
    })
})

describe('benchAssets', () => {
    it('yields unique ids, and a collectible at every fifth index', () => {
        const assets = benchAssets(20)

        expect(new Set(assets.map(a => a.assetId)).size).toBe(20)
        expect(
            assets
                .map((a, i) => [i, a.peraMetadata?.type] as const)
                .filter(([, type]) => type === 'collectible')
                .map(([i]) => i),
        ).toEqual([4, 9, 14, 19])
    })

    it('continues from an offset without repeating ids', () => {
        const ids = [...benchAssets(10), ...benchAssets(10, 10)].map(
            a => a.assetId,
        )

        expect(new Set(ids).size).toBe(20)
    })

    it('is deterministic', () => {
        expect(benchAssets(5)).toEqual(benchAssets(5))
    })
})

describe('benchHoldings', () => {
    it('holds one of each collectible and a positive amount of the rest', () => {
        const assets = benchAssets(10)
        const holdings = benchHoldings(assets)

        expect(holdings.map(h => h.assetId)).toEqual(assets.map(a => a.assetId))
        expect(holdings[4].amount.toString()).toBe('1')
        expect(holdings.every(h => h.amount.gt(0))).toBe(true)
    })
})

describe('benchTransactions', () => {
    it('yields unique ids with the newest first', () => {
        const rows = benchTransactions(algorandAddress(0), 50)

        expect(new Set(rows.map(r => r.id)).size).toBe(50)
        expect(rows.map(r => r.roundTime)).toEqual(
            [...rows.map(r => r.roundTime)].sort((a, b) => b - a),
        )
    })

    it('keeps ids apart between two accounts', () => {
        const a = benchTransactions(algorandAddress(0), 5).map(r => r.id)
        const b = benchTransactions(algorandAddress(1), 5).map(r => r.id)

        expect(a.filter(id => b.includes(id))).toEqual([])
    })
})

describe('benchWatchAccounts', () => {
    it('gives each account an Algorand entry, and EVM entries on the other chains', () => {
        const accounts = benchWatchAccounts(3, ['algorand', 'ethereum'])

        expect(accounts).toHaveLength(3)
        expect(accounts[0].chains.algorand?.address).toBe(algorandAddress(0))
        expect(accounts[0].chains.ethereum?.address).toBe(evmAddress(0))
        expect(accounts.every(a => a.custody.kind === 'watch')).toBe(true)
    })

    it('uses unique ids', () => {
        const ids = benchWatchAccounts(20, ['algorand']).map(a => a.id)

        expect(new Set(ids).size).toBe(20)
    })
})

describe('assetsHeldBy', () => {
    const universe = benchAssets(100)

    it('gives the heavy account the whole universe', () => {
        expect(assetsHeldBy(0, 5, universe)).toEqual(universe)
    })

    it('gives the others a rotating slice that wraps past the end', () => {
        const held = assetsHeldBy(19, 10, universe).map(a => a.assetId)

        expect(held).toHaveLength(10)
        expect(held[0]).toBe(universe[90].assetId)
        expect(held[9]).toBe(universe[99].assetId)
        expect(assetsHeldBy(20, 10, universe)[0].assetId).toBe(
            universe[0].assetId,
        )
    })

    it('never holds more than the universe has', () => {
        expect(assetsHeldBy(1, 50, benchAssets(3))).toHaveLength(3)
    })
})
