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
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
// Type-only, so a chain package can run this suite without loading the database.
import type { AssetsChainAdapter } from '../chain-adapter'

export type AssetMetadataOps = Pick<
    AssetsChainAdapter,
    | 'chainId'
    | 'getNativeAsset'
    | 'syncAssets'
    | 'fetchAsset'
    | 'fetchOnChainAsset'
>

export interface AssetMetadataContractFixtures {
    scope: ChainScope
    nativeAssetId: string
    /** A token every metadata source under `handlers` knows. */
    token: { assetId: string; unitName: string; decimals: number }
    /** Installed before every case. */
    handlers: readonly RequestHandler[]
    /** Asset ids the ops have persisted so far. */
    persistedIds: () => string[]
}

/** A chain package runs this against its metadata operations before its full adapter exists. */
export const assetMetadataContractTests = (
    makeOps: () => AssetMetadataOps,
    fixtures: AssetMetadataContractFixtures,
    label?: string,
): void => {
    const server = setupServer()
    const { scope, token } = fixtures

    describe(`AssetsChainAdapter metadata contract: ${makeOps().chainId}${label ? ` (${label})` : ''}`, () => {
        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        beforeEach(() => server.use(...fixtures.handlers))
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        it('returns one native asset instance with the native id', () => {
            const native = makeOps().getNativeAsset()

            expect(native.assetId).toBe(fixtures.nativeAssetId)
            expect(makeOps().getNativeAsset()).toBe(native)
        })

        it('fetches a token with its unit name and decimals', async () => {
            const asset = await makeOps().fetchAsset(token.assetId, scope)

            expect(asset).toMatchObject(token)
        })

        it("reads a token from the chain's own record", async () => {
            const asset = await makeOps().fetchOnChainAsset(
                token.assetId,
                scope,
            )

            expect(asset).toMatchObject(token)
        })

        it('persists a synced token', async () => {
            await makeOps().syncAssets([token.assetId], scope)

            expect(fixtures.persistedIds()).toContain(token.assetId)
        })

        it('accepts the native id in a sync', async () => {
            await expect(
                makeOps().syncAssets([fixtures.nativeAssetId], scope),
            ).resolves.toBeUndefined()
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
    const foreignChainId = CHAIN_IDS.find(id => id !== ops.chainId)
    if (!foreignChainId) throw new Error('Contract needs a second chain id')

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
