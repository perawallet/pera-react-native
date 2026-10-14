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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { setupServer } from 'msw/node'
import type { RequestHandler } from 'msw'
import type { Decimal } from 'decimal.js'
import {
    assetRefKey,
    CHAIN_IDS,
    type AssetPrice,
    type AssetRef,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
// Type-only, so a chain package can run this suite without loading the database.
import type { AssetAuthorities, AssetsChainAdapter } from '../chain-adapter'

export type AssetMetadataOps = Pick<
    AssetsChainAdapter,
    | 'chainId'
    | 'getNativeAsset'
    | 'syncAssets'
    | 'getAssetMetadata'
    | 'fetchOnChainAsset'
    | 'fetchAssetAuthorities'
    | 'search'
>

export interface AssetMetadataContractFixtures {
    scope: ChainScope
    nativeAssetId: string
    /** A token every metadata source under `handlers` knows. */
    token: { assetId: string; unitName: string; decimals: number }
    /** Set exactly when the ops declare `fetchAssetAuthorities`. */
    tokenAuthorities?: AssetAuthorities
    /** Set when the ops declare `search` and `scope` can serve it. */
    search?: { query: string; hitAssetIds: string[] }
    /** Installed before every case. */
    handlers: readonly RequestHandler[]
    /** Asset ids the ops have persisted so far. */
    persistedIds: () => string[]
}

const foreignChainIdOf = (chainId: ChainId): ChainId => {
    const foreign = CHAIN_IDS.find(id => id !== chainId)
    if (!foreign) throw new Error('Contract needs a second chain id')
    return foreign
}

/** A chain package runs this against its metadata operations before its full adapter exists. */
export const assetMetadataContractTests = (
    makeOps: () => AssetMetadataOps,
    fixtures: AssetMetadataContractFixtures,
    label?: string,
): void => {
    const server = setupServer()
    const { scope, token } = fixtures
    const chainId = makeOps().chainId
    const foreignChainId = foreignChainIdOf(chainId)
    const nativeRef: AssetRef = { chainId, assetId: fixtures.nativeAssetId }
    const tokenRef: AssetRef = { chainId, assetId: token.assetId }
    const foreignRef: AssetRef = { ...tokenRef, chainId: foreignChainId }
    const foreignScope: ChainScope = { ...scope, chainId: foreignChainId }

    describe(`AssetsChainAdapter metadata contract: ${chainId}${label ? ` (${label})` : ''}`, () => {
        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        beforeEach(() => server.use(...fixtures.handlers))
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        it('returns one native asset instance with the native id', () => {
            const native = makeOps().getNativeAsset()

            expect(native.assetId).toBe(fixtures.nativeAssetId)
            expect(makeOps().getNativeAsset()).toBe(native)
        })

        it('answers the native ref with that instance, without a request', async () => {
            const ops = makeOps()

            const asset = await ops.getAssetMetadata(nativeRef, scope)

            expect(asset).toBe(ops.getNativeAsset())
        })

        it('fetches a token with its unit name and decimals', async () => {
            const asset = await makeOps().getAssetMetadata(tokenRef, scope)

            expect(asset).toMatchObject(token)
        })

        it("reads a token from the chain's own record", async () => {
            const asset = await makeOps().fetchOnChainAsset(tokenRef, scope)

            expect(asset).toMatchObject(token)
        })

        it("reports a token's freeze and clawback authorities exactly when it declares them", async () => {
            const ops = makeOps()

            expect(ops.fetchAssetAuthorities !== undefined).toBe(
                fixtures.tokenAuthorities !== undefined,
            )
            if (ops.fetchAssetAuthorities) {
                await expect(
                    ops.fetchAssetAuthorities(tokenRef, scope),
                ).resolves.toEqual(fixtures.tokenAuthorities)
            }
        })

        it('persists a synced token', async () => {
            await makeOps().syncAssets([tokenRef], scope)

            expect(fixtures.persistedIds()).toContain(token.assetId)
        })

        it('accepts the native ref in a sync', async () => {
            await expect(
                makeOps().syncAssets([nativeRef], scope),
            ).resolves.toBeUndefined()
        })

        if (fixtures.search) {
            const { query, hitAssetIds } = fixtures.search

            it('finds assets by query', async () => {
                const { search } = makeOps()

                expect(search).toBeDefined()
                const page = await search!({ query }, scope)

                expect(page.results.map(r => r.assetId).sort()).toEqual(
                    [...hitAssetIds].sort(),
                )
            })
        }

        it('rejects a ref on another chain', async () => {
            const ops = makeOps()

            await expect(ops.syncAssets([foreignRef], scope)).rejects.toThrow()
            await expect(
                ops.getAssetMetadata(foreignRef, scope),
            ).rejects.toThrow()
            await expect(
                ops.fetchOnChainAsset(foreignRef, scope),
            ).rejects.toThrow()
            if (ops.fetchAssetAuthorities) {
                await expect(
                    ops.fetchAssetAuthorities(foreignRef, scope),
                ).rejects.toThrow()
            }
        })

        it('rejects a scope on another chain', async () => {
            const ops = makeOps()

            await expect(
                ops.syncAssets([tokenRef], foreignScope),
            ).rejects.toThrow()
            await expect(
                ops.getAssetMetadata(tokenRef, foreignScope),
            ).rejects.toThrow()
            await expect(
                ops.getAssetMetadata(nativeRef, foreignScope),
            ).rejects.toThrow()
            await expect(
                ops.fetchOnChainAsset(tokenRef, foreignScope),
            ).rejects.toThrow()
            if (ops.fetchAssetAuthorities) {
                await expect(
                    ops.fetchAssetAuthorities(tokenRef, foreignScope),
                ).rejects.toThrow()
            }
            if (ops.search) {
                await expect(
                    ops.search({ query: 'x' }, foreignScope),
                ).rejects.toThrow()
            }
        })
    })
}

export type AssetPriceOps = Pick<
    AssetsChainAdapter,
    'chainId' | 'getNativeAsset' | 'maxPriceIdsPerRequest' | 'getPrices'
>

export interface AssetPriceContractFixtures {
    scope: ChainScope
    /** A token the source under `handlers` prices. */
    priced: AssetPrice
    /** A token the source knows but has no price for. */
    unpriced: AssetRef
    nativeUsdPrice: Decimal
    /** Installed before every case. */
    handlers: readonly RequestHandler[]
}

const keysOf = (prices: AssetPrice[]): string[] =>
    prices.map(p => assetRefKey(p.assetRef)).sort()

export const assetPriceContractTests = (
    makeOps: () => AssetPriceOps,
    fixtures: AssetPriceContractFixtures,
    label?: string,
): void => {
    const server = setupServer()
    const ops = makeOps()
    const { scope, priced, unpriced, nativeUsdPrice } = fixtures
    const nativeRef: AssetRef = {
        chainId: ops.chainId,
        assetId: ops.getNativeAsset().assetId,
    }
    const foreignChainId = foreignChainIdOf(ops.chainId)

    describe(`AssetsChainAdapter price contract: ${ops.chainId}${label ? ` (${label})` : ''}`, () => {
        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        beforeEach(() => server.use(...fixtures.handlers))
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        it('takes at least one ref per request', () => {
            expect(Number.isInteger(ops.maxPriceIdsPerRequest)).toBe(true)
            expect(ops.maxPriceIdsPerRequest).toBeGreaterThan(0)
        })

        it('prices a priced token in USD, keyed by the ref it was asked for', async () => {
            const prices = await ops.getPrices(
                [priced.assetRef, unpriced],
                scope,
            )

            const found = prices.find(
                p => assetRefKey(p.assetRef) === assetRefKey(priced.assetRef),
            )
            expect(found?.assetRef).toEqual(priced.assetRef)
            expect(found?.usdPrice.equals(priced.usdPrice)).toBe(true)
        })

        it('leaves an unpriced token out rather than pricing it 0', async () => {
            const prices = await ops.getPrices(
                [priced.assetRef, unpriced],
                scope,
            )

            expect(keysOf(prices)).toEqual([assetRefKey(priced.assetRef)])
        })

        it('prices the native asset on its own', async () => {
            const prices = await ops.getPrices([nativeRef], scope)

            expect(keysOf(prices)).toEqual([assetRefKey(nativeRef)])
            expect(prices[0].usdPrice.equals(nativeUsdPrice)).toBe(true)
        })

        it('prices the native asset alongside tokens in one call', async () => {
            const prices = await ops.getPrices(
                [nativeRef, priced.assetRef, unpriced],
                scope,
            )

            expect(keysOf(prices)).toEqual(
                [assetRefKey(nativeRef), assetRefKey(priced.assetRef)].sort(),
            )
        })

        it('resolves to no prices for no refs', async () => {
            await expect(ops.getPrices([], scope)).resolves.toEqual([])
        })

        it('rejects a scope on another chain', async () => {
            await expect(
                ops.getPrices([priced.assetRef], {
                    ...scope,
                    chainId: foreignChainId,
                }),
            ).rejects.toThrow()
        })

        it('rejects a ref on another chain', async () => {
            await expect(
                ops.getPrices(
                    [{ ...priced.assetRef, chainId: foreignChainId }],
                    scope,
                ),
            ).rejects.toThrow()
        })
    })
}
