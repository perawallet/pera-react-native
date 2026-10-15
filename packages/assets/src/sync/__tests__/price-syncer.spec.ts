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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const getPricesMock = vi.hoisted(() => vi.fn())
const upsertAssetPricesMock = vi.hoisted(() => vi.fn())
const getStaleOrMissingPriceAssetIdsMock = vi.hoisted(() => vi.fn())
const recordPriceMissesMock = vi.hoisted(() => vi.fn())
const clearPriceMissesMock = vi.hoisted(() => vi.fn())

vi.mock('../../db', () => ({
    upsertAssetPrices: upsertAssetPricesMock,
    getStaleOrMissingPriceAssetIds: getStaleOrMissingPriceAssetIdsMock,
    recordPriceMisses: recordPriceMissesMock,
    clearPriceMisses: clearPriceMissesMock,
}))

import { Decimal } from 'decimal.js'
import {
    ChainAdapterNotRegisteredError,
    type AssetPrice,
    type AssetRef,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { assetsChainAdapters } from '../../chain-adapter'
import {
    FAKE_NATIVE_ASSET,
    fakeAssetsAdapter,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { fetchAndPersistPrices } from '../price-syncer'

const mainnetScope: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const testnetScope: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

const ref = (assetId: string): AssetRef => ({ chainId: 'algorand', assetId })

const priced = (assetId: string, usdPrice: string): AssetPrice => ({
    assetRef: ref(assetId),
    usdPrice: new Decimal(usdPrice),
})

// The native asset is priced in its own call, so a case can answer it and the
// token batches differently.
const answer = (native: AssetPrice[] | Error, batch: AssetPrice[] | Error) =>
    getPricesMock.mockImplementation(async (refs: AssetRef[]) => {
        const result = refs[0].assetId === '0' ? native : batch
        if (result instanceof Error) throw result
        return result
    })

describe('fetchAndPersistPrices', () => {
    beforeEach(() => {
        getPricesMock.mockReset()
        registerFakeAssetsAdapter({ getPrices: getPricesMock })
        upsertAssetPricesMock.mockReset()
        getStaleOrMissingPriceAssetIdsMock.mockReset()
        recordPriceMissesMock.mockReset()
        clearPriceMissesMock.mockReset()
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) => assetIds,
        )
    })

    test('no-ops on empty input', async () => {
        await fetchAndPersistPrices([], mainnetScope)
        expect(getPricesMock).not.toHaveBeenCalled()
    })

    test('fetches and persists prices for non-ALGO ids and the ALGO price separately', async () => {
        answer([priced('0', '0.2')], [priced('123', '2.0')])

        await fetchAndPersistPrices(['123', '0'], mainnetScope)

        expect(getPricesMock).toHaveBeenCalledWith([ref('123')], mainnetScope)
        expect(getPricesMock).toHaveBeenCalledWith([ref('0')], mainnetScope)
        // 2 upserts: one for batch, one for ALGO
        expect(upsertAssetPricesMock).toHaveBeenCalledTimes(2)
    })

    test('upserts exactly the rows the adapter priced', async () => {
        answer([priced('0', '0.2')], [priced('123', '2')])

        await fetchAndPersistPrices(['123', '0'], mainnetScope)

        const rows = upsertAssetPricesMock.mock.calls.flatMap(c => c[0].prices)
        expect(rows).toHaveLength(2)
        expect(
            rows.map((r: { assetId: string; usdPrice: Decimal }) => [
                r.assetId,
                r.usdPrice.toString(),
            ]),
        ).toEqual(
            expect.arrayContaining([
                ['123', '2'],
                ['0', '0.2'],
            ]),
        )
        expect(upsertAssetPricesMock).toHaveBeenCalledWith(
            expect.objectContaining({ scope: mainnetScope }),
        )
    })

    test('writes no native row when the adapter has no native price', async () => {
        answer([], [priced('123', '2')])

        await expect(
            fetchAndPersistPrices(['123', '0'], mainnetScope),
        ).resolves.toBeUndefined()

        const rows = upsertAssetPricesMock.mock.calls.flatMap(c => c[0].prices)
        expect(rows.map((r: { assetId: string }) => r.assetId)).toEqual(['123'])
    })

    test('a failed batch does not block the native row', async () => {
        answer([priced('0', '0.2')], new Error('batch failed'))

        await expect(
            fetchAndPersistPrices(['123', '0'], mainnetScope),
        ).resolves.toBeUndefined()

        expect(upsertAssetPricesMock).toHaveBeenCalledWith({
            prices: [expect.objectContaining({ assetId: '0' })],
            scope: mainnetScope,
        })
    })

    test('skips the ALGO fetch when the ALGO price is fresh', async () => {
        // Fresh only for the ALGO lookup — batch ids stay stale.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        getPricesMock.mockResolvedValue([priced('124', '2.0')])

        await fetchAndPersistPrices(['124', '0'], mainnetScope)

        expect(getPricesMock).not.toHaveBeenCalledWith([ref('0')], mainnetScope)
        expect(getPricesMock).toHaveBeenCalledWith([ref('124')], mainnetScope)
    })

    test('skips batch ids whose price row is still fresh', async () => {
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue(['456'])
        answer([priced('0', '0.2')], [priced('456', '1.0')])

        await fetchAndPersistPrices(['123', '456'], mainnetScope)

        expect(getPricesMock).toHaveBeenCalledWith([ref('456')], mainnetScope)
    })

    test('gates batch ids on the persisted miss window', async () => {
        answer([priced('0', '0.2')], [priced('777', '1.0')])

        await fetchAndPersistPrices(['777'], testnetScope)

        expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetIds: ['777'],
                scope: testnetScope,
                missRetryMs: expect.any(Number),
            }),
        )
    })

    test('records a persisted miss for ids the price source left out', async () => {
        answer([priced('0', '0.2')], [priced('555', '1.0')])

        await fetchAndPersistPrices(['555', '777'], testnetScope)

        expect(recordPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['777'],
            scope: testnetScope,
        })
        const upserted = upsertAssetPricesMock.mock.calls.flatMap(
            c => c[0]?.prices ?? [],
        )
        expect(
            upserted.some((p: { assetId: string }) => p.assetId === '777'),
        ).toBe(false)
    })

    test('clears persisted misses for ids that returned a price', async () => {
        answer([priced('0', '0.2')], [priced('555', '1.0')])

        await fetchAndPersistPrices(['555', '777'], testnetScope)

        expect(clearPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['555'],
            scope: testnetScope,
        })
    })

    test('records nothing when every id returned a price', async () => {
        answer([priced('0', '0.2')], [priced('555', '1.0')])

        await fetchAndPersistPrices(['555'], testnetScope)

        expect(recordPriceMissesMock).not.toHaveBeenCalled()
    })

    test('throws when every batch settles as rejected', async () => {
        getPricesMock.mockRejectedValue(new Error('price source failed'))

        await expect(
            fetchAndPersistPrices(['999'], mainnetScope),
        ).rejects.toThrow('All price sync batches failed')
        expect(getPricesMock).toHaveBeenCalledWith([ref('999')], mainnetScope)
    })

    test('records misses for every priceless id on a large portfolio (no cap)', async () => {
        answer([priced('0', '0.2')], [])

        const manyIds = Array.from({ length: 600 }, (_, i) => `${1000 + i}`)
        await fetchAndPersistPrices(manyIds, mainnetScope)

        const recorded = recordPriceMissesMock.mock.calls.flatMap(
            call => call[0].assetIds as string[],
        )
        expect(new Set(recorded).size).toBe(600)
    })

    test('still throws when ALGO was skipped fresh but every real batch failed', async () => {
        // Fresh only for the ALGO lookup — the batch must still be attempted.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        answer([], new Error('batch failed'))

        await expect(
            fetchAndPersistPrices(['123', '0'], mainnetScope),
        ).rejects.toThrow('All price sync batches failed')
    })

    test('sizes batches by the adapter limit', async () => {
        assetsChainAdapters.reset()
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                maxPriceIdsPerRequest: 2,
                getPrices: getPricesMock,
            }),
        )
        answer([priced('0', '0.2')], [])

        await fetchAndPersistPrices(['11', '12', '13'], mainnetScope)

        expect(getPricesMock).toHaveBeenCalledWith(
            [ref('11'), ref('12')],
            mainnetScope,
        )
        expect(getPricesMock).toHaveBeenCalledWith([ref('13')], mainnetScope)
    })

    test('treats the adapter native id, not a literal, as the native asset', async () => {
        assetsChainAdapters.reset()
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                getNativeAsset: () => ({
                    ...fakeAssetsAdapter().getNativeAsset(),
                    assetId: 'native',
                }),
                getPrices: getPricesMock,
            }),
        )
        getPricesMock.mockImplementation(async (refs: AssetRef[]) =>
            refs[0].assetId === 'native' ? [priced('native', '0.2')] : [],
        )

        await fetchAndPersistPrices(['native', '0'], mainnetScope)

        expect(getPricesMock).toHaveBeenCalledWith([ref('0')], mainnetScope)
        expect(upsertAssetPricesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                prices: [expect.objectContaining({ assetId: 'native' })],
            }),
        )
    })

    test.each(['mainnet', 'betanet'])(
        'rejects when no adapter is registered, even on %s',
        async networkId => {
            assetsChainAdapters.reset()

            await expect(
                fetchAndPersistPrices(['123'], {
                    chainId: 'algorand',
                    networkId,
                }),
            ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        },
    )

    describe('whole-wallet pass dedupe', () => {
        const manyIds = Array.from({ length: 1000 }, (_, i) => `${i + 1}`)

        test('concurrent large passes for one scope share a single pass', async () => {
            // The gate resolves on a macrotask so the second call is issued
            // while the first pass is still in flight.
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            getPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, mainnetScope),
                fetchAndPersistPrices(manyIds, mainnetScope),
            ])

            // One gate call for the batch path plus one for the ALGO check —
            // a second full pass would double both.
            expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledTimes(2)
        })

        test('large passes on different scopes run independently', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                async ({ assetIds }: { assetIds: string[] }) => assetIds,
            )
            getPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, mainnetScope),
                fetchAndPersistPrices(manyIds, testnetScope),
            ])

            const networks = getStaleOrMissingPriceAssetIdsMock.mock.calls.map(
                call => (call[0].scope as ChainScope).networkId,
            )
            expect(networks.filter(n => n === 'mainnet').length).toBe(2)
            expect(networks.filter(n => n === 'testnet').length).toBe(2)
        })

        test('a large pass joins an in-flight pass that covers all of its ids', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            getPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, mainnetScope),
                // A 300-asset account whose ids the whole-wallet pass already
                // covers — waiting on that pass prices everything it needs.
                fetchAndPersistPrices(manyIds.slice(0, 300), mainnetScope),
            ])

            // Batch gate + ALGO gate for the single shared pass.
            expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledTimes(2)
        })

        test('a large pass with ids the in-flight pass never saw runs its own pass', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            getPricesMock.mockResolvedValue([])

            // A freshly imported 300-asset account: joining the in-flight
            // whole-wallet pass would resolve without ever pricing its ids.
            const freshImportIds = Array.from(
                { length: 300 },
                (_, i) => `fresh-${i}`,
            )
            await Promise.all([
                fetchAndPersistPrices(manyIds, mainnetScope),
                fetchAndPersistPrices(freshImportIds, mainnetScope),
            ])

            const gatedIds =
                getStaleOrMissingPriceAssetIdsMock.mock.calls.flatMap(
                    call => call[0].assetIds as string[],
                )
            expect(gatedIds).toContain('fresh-0')
            expect(gatedIds).toContain('fresh-299')
        })

        test('small enrichment lists are not deduped against each other', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                async ({ assetIds }: { assetIds: string[] }) => assetIds,
            )
            getPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(['123'], mainnetScope),
                fetchAndPersistPrices(['456'], mainnetScope),
            ])

            const batchGateIds =
                getStaleOrMissingPriceAssetIdsMock.mock.calls.flatMap(
                    call => call[0].assetIds as string[],
                )
            expect(batchGateIds).toContain('123')
            expect(batchGateIds).toContain('456')
        })
    })

    describe('with two chains registered', () => {
        // ChainId is a closed union, so the second chain rides on Ethereum's id.
        const fixtureScope: ChainScope = {
            chainId: 'ethereum',
            networkId: 'mainnet',
        }
        // One instance, as the adapter contract requires.
        const FIXTURE_NATIVE = { ...FAKE_NATIVE_ASSET, assetId: 'native' }
        const fixtureRef = (assetId: string): AssetRef => ({
            chainId: 'ethereum',
            assetId,
        })
        const fixtureGetPricesMock = vi.fn()

        beforeEach(() => {
            fixtureGetPricesMock.mockReset()
            fixtureGetPricesMock.mockResolvedValue([])
            getPricesMock.mockResolvedValue([])
            assetsChainAdapters.reset()
            assetsChainAdapters.register(
                fakeAssetsAdapter({ getPrices: getPricesMock }),
            )
            assetsChainAdapters.register(
                fakeAssetsAdapter({
                    chainId: 'ethereum',
                    getNativeAsset: () => FIXTURE_NATIVE,
                    getPrices: fixtureGetPricesMock,
                }),
            )
        })

        test("prices a scope through its own chain's adapter and persists under that scope", async () => {
            fixtureGetPricesMock.mockImplementation(async (refs: AssetRef[]) =>
                refs[0].assetId === 'native'
                    ? [{ assetRef: refs[0], usdPrice: new Decimal('2000') }]
                    : [{ assetRef: refs[0], usdPrice: new Decimal('4') }],
            )

            await fetchAndPersistPrices(['native', 'tok', 'gone'], fixtureScope)

            expect(getPricesMock).not.toHaveBeenCalled()
            expect(fixtureGetPricesMock).toHaveBeenCalledWith(
                [fixtureRef('native')],
                fixtureScope,
            )
            expect(fixtureGetPricesMock).toHaveBeenCalledWith(
                [fixtureRef('tok'), fixtureRef('gone')],
                fixtureScope,
            )
            for (const mock of [
                getStaleOrMissingPriceAssetIdsMock,
                upsertAssetPricesMock,
                recordPriceMissesMock,
                clearPriceMissesMock,
            ]) {
                expect(mock).toHaveBeenCalled()
                for (const [args] of mock.mock.calls) {
                    expect(args.scope).toEqual(fixtureScope)
                }
            }
            expect(recordPriceMissesMock).toHaveBeenCalledWith({
                assetIds: ['gone'],
                scope: fixtureScope,
            })
        })

        test('an Algorand pass makes the same calls it makes with Algorand alone', async () => {
            await fetchAndPersistPrices(['123', '0'], mainnetScope)

            expect(fixtureGetPricesMock).not.toHaveBeenCalled()
            expect(getPricesMock.mock.calls).toEqual([
                [[ref('0')], mainnetScope],
                [[ref('123')], mainnetScope],
            ])
        })

        test('whole-wallet passes on two scopes run independently', async () => {
            const manyIds = Array.from({ length: 1000 }, (_, i) => `${i + 1}`)
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )

            await Promise.all([
                fetchAndPersistPrices(manyIds, mainnetScope),
                fetchAndPersistPrices(manyIds, fixtureScope),
            ])

            expect(getPricesMock).toHaveBeenCalled()
            expect(fixtureGetPricesMock).toHaveBeenCalled()
        })

        test('a scope whose chain has no adapter rejects while the other chain still prices', async () => {
            assetsChainAdapters.reset()
            assetsChainAdapters.register(
                fakeAssetsAdapter({ getPrices: getPricesMock }),
            )

            const [fixture, algorand] = await Promise.allSettled([
                fetchAndPersistPrices(['tok'], fixtureScope),
                fetchAndPersistPrices(['123'], mainnetScope),
            ])

            expect(fixture.status).toBe('rejected')
            expect(
                fixture.status === 'rejected' && fixture.reason,
            ).toBeInstanceOf(ChainAdapterNotRegisteredError)
            expect(algorand.status).toBe('fulfilled')
            expect(getPricesMock).toHaveBeenCalledWith(
                [ref('123')],
                mainnetScope,
            )
        })
    })
})
