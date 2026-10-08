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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
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
