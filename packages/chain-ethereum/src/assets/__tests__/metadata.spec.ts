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
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    createEthereumAssetOps,
    type EthereumAssetPersistence,
} from '../metadata'
import { ETHEREUM_NATIVE_ASSET } from '../native-asset'
import { ASSETS_PATH } from '../api/endpoints'
import type { AssetItemResponse } from '../api/schema'
import { peraEvmAssetHandlers, unknownAssetItem } from '../api/msw-handlers'
import {
    erc20CallResponder,
    evmRpcHandlers,
    type Erc20Fixture,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI_CAIP19 = `eip155:1/erc20:${DAI.toLowerCase()}`
const ZERO = '0x0000000000000000000000000000000000000000'
const quarantinedDai: AssetItemResponse = {
    ...unknownAssetItem(DAI_CAIP19),
    verification_tier: 'suspicious',
}
const daiOnChain: Erc20Fixture = {
    name: 'Totally DAI',
    symbol: 'DAI',
    decimals: 18,
    totalSupply: 10n ** 24n,
}
const usdcOnChain: Erc20Fixture = {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    totalSupply: 10n ** 12n,
}
const usdcFromPera: AssetItemResponse = {
    ...unknownAssetItem(USDC_CAIP19),
    type: 'erc20',
    name: 'Pera USD Coin',
    unit_name: 'pUSDC',
    // Wrong on purpose: the chain's decimals must win.
    fraction_decimals: 18,
    logo: 'https://pera.test/usdc.png',
    is_verified: true,
    verification_tier: 'verified',
}

const rpc = (tokens: Record<string, Erc20Fixture>) =>
    evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: { eth_call: erc20CallResponder(tokens) },
    })

const memoryPersistence = (stale: (ids: string[]) => string[] = ids => ids) => {
    const node: PeraAsset[] = []
    const full: PeraAsset[] = []
    const persistence: EthereumAssetPersistence = {
        getStaleOrMissingAssetIds: vi.fn(
            async ({ assetIds }: { assetIds: string[] }) => stale(assetIds),
        ),
        upsertAssets: vi.fn(async ({ items }: { items: PeraAsset[] }) => {
            full.push(...items)
        }),
        upsertNodeAssets: vi.fn(async ({ items }: { items: PeraAsset[] }) => {
            node.push(...items)
        }),
    }
    return { persistence, node, full }
}

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
    server.resetHandlers()
    server.events.removeAllListeners()
})
afterAll(() => server.close())

const recordRequests = (): string[] => {
    const urls: string[] = []
    server.events.on('request:start', ({ request }) => {
        urls.push(request.url)
    })
    return urls
}

describe('fetchAsset', () => {
    it("keeps the chain's name, symbol, decimals and supply over the backend's", async () => {
        server.use(
            ...rpc({ [USDC]: usdcOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [USDC_CAIP19]: usdcFromPera },
            }),
        )
        const { persistence, node } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        const asset = await ops.fetchAsset(USDC, SCOPE)

        expect(asset).toMatchObject({
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: {
                verificationTier: 'verified',
                logo: 'https://pera.test/usdc.png',
            },
        })
        expect(asset.totalSupply.toFixed()).toBe('1000000000000')
        expect(node.map(a => a.assetId)).toEqual([USDC])
    })

    it('falls back to the backend record when the chain read fails', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [USDC_CAIP19]: usdcFromPera },
            }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await expect(ops.fetchAsset(USDC, SCOPE)).resolves.toMatchObject({
            unitName: 'pUSDC',
        })
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
    })

    it('rejects without persisting when every source fails', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, assets: 503 }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await expect(ops.fetchAsset(USDC, SCOPE)).rejects.toThrow()
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
    })

    it('rejects when the chain fails and the backend does not know the token', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await expect(ops.fetchAsset(USDC, SCOPE)).rejects.toThrow()
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
    })

    it('returns a quarantined token from the chain as suspicious', async () => {
        server.use(
            ...rpc({ [DAI]: daiOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
        )
        const { persistence, node, full } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        const asset = await ops.fetchAsset(DAI, SCOPE)

        expect(asset).toMatchObject({
            assetId: DAI,
            unitName: 'DAI',
            decimals: 18,
            peraMetadata: { verificationTier: 'suspicious' },
        })
        // Both halves: a node row alone would read as fresh for the TTL and
        // render without the suspicious tier.
        expect(node).toEqual([])
        expect(full).toHaveLength(1)
        expect(full[0]).toMatchObject({
            assetId: DAI,
            peraMetadata: { verificationTier: 'suspicious' },
        })
    })

    it('rejects a quarantined token the chain cannot read, without persisting', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await expect(ops.fetchAsset(DAI, SCOPE)).rejects.toThrow()
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('rejects the zero address without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            memoryPersistence().persistence,
        )

        await expect(ops.fetchAsset(ZERO, SCOPE)).rejects.toThrow()
        expect(requests).toEqual([])
    })

    it('rejects an id that is not an address without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            memoryPersistence().persistence,
        )

        await expect(ops.fetchAsset('not-an-address', SCOPE)).rejects.toThrow()
        expect(requests).toEqual([])
    })

    it('returns the native asset without a request', async () => {
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            memoryPersistence().persistence,
        )

        await expect(
            ops.fetchAsset(ETHEREUM_NATIVE_ASSET.assetId, SCOPE),
        ).resolves.toBe(ETHEREUM_NATIVE_ASSET)
    })
})

describe('syncAssets', () => {
    it('fetches only stale tokens from the backend and persists both halves', async () => {
        const requested: unknown[] = []
        server.use(
            http.post(`${TEST_PERA_URL}${ASSETS_PATH}`, async ({ request }) => {
                requested.push(await request.json())
                return HttpResponse.json({ results: [usdcFromPera] })
            }),
        )
        const { persistence, full } = memoryPersistence(ids =>
            ids.filter(id => id !== DAI),
        )
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([ETHEREUM_NATIVE_ASSET.assetId, USDC, DAI], SCOPE)

        expect(persistence.getStaleOrMissingAssetIds).toHaveBeenCalledWith(
            expect.objectContaining({ assetIds: [USDC, DAI] }),
        )
        expect(requested).toEqual([{ ids: [USDC_CAIP19] }])
        expect(full.map(a => a.assetId)).toEqual([USDC])
    })

    it('checks staleness under the checksummed id', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([USDC.toLowerCase()], SCOPE)

        expect(persistence.getStaleOrMissingAssetIds).toHaveBeenCalledWith(
            expect.objectContaining({ assetIds: [USDC] }),
        )
    })

    it('drops ids that are not addresses without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            memoryPersistence().persistence,
        )

        await ops.syncAssets(['not-an-address'], SCOPE)

        expect(requests).toEqual([])
    })

    it('reads on-chain the tokens the backend did not return', async () => {
        server.use(
            ...rpc({ [DAI]: usdcOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [USDC_CAIP19]: usdcFromPera },
            }),
        )
        const { persistence, node, full } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([USDC, DAI], SCOPE)

        expect(full.map(a => a.assetId)).toEqual([USDC])
        expect(node.map(a => a.assetId)).toEqual([DAI])
    })

    it('reads on-chain the tokens the backend answers without metadata', async () => {
        server.use(
            ...rpc({ [DAI]: usdcOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: {
                    [USDC_CAIP19]: usdcFromPera,
                    [DAI_CAIP19]: unknownAssetItem(DAI_CAIP19),
                },
            }),
        )
        const { persistence, node, full } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([USDC, DAI], SCOPE)

        expect(full.map(a => a.assetId)).toEqual([USDC])
        expect(node.map(a => a.assetId)).toEqual([DAI])
    })

    it('persists a quarantined token as suspicious with its on-chain intrinsics', async () => {
        server.use(
            ...rpc({ [DAI]: daiOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
        )
        const { persistence, node, full } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([DAI], SCOPE)

        expect(node).toEqual([])
        expect(full).toHaveLength(1)
        expect(full[0]).toMatchObject({
            assetId: DAI,
            decimals: 18,
            peraMetadata: { verificationTier: 'suspicious' },
        })
    })

    it('persists nothing for a quarantined token the chain cannot read', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([DAI], SCOPE)

        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('drops the zero address, which the backend rejects', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([ZERO, USDC], SCOPE)

        expect(persistence.getStaleOrMissingAssetIds).toHaveBeenCalledWith(
            expect.objectContaining({ assetIds: [USDC] }),
        )
    })

    it('requests at most 500 ids at a time', async () => {
        const ids = Array.from(
            { length: 501 },
            (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
        )
        const batchSizes: number[] = []
        server.use(
            http.post(`${TEST_PERA_URL}${ASSETS_PATH}`, async ({ request }) => {
                const body = (await request.json()) as { ids: string[] }
                batchSizes.push(body.ids.length)
                return HttpResponse.json({
                    results: body.ids.map(id => ({
                        ...unknownAssetItem(id),
                        type: 'erc20',
                        name: 'Token',
                        unit_name: 'TKN',
                        fraction_decimals: 18,
                    })),
                })
            }),
        )
        const { persistence, full } = memoryPersistence()
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets(ids, SCOPE)

        expect(batchSizes).toEqual([500, 1])
        expect(full).toHaveLength(501)
    })

    it('makes no request when nothing is stale', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            persistence,
        )

        await ops.syncAssets([USDC], SCOPE)

        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('reads the chain without the assets service and leaves failed tokens out', async () => {
        server.use(...rpc({ [USDC]: usdcOnChain }))
        const { persistence, node } = memoryPersistence()
        const ops = createEthereumAssetOps(testChainContext(), persistence)

        await ops.syncAssets([USDC, DAI], SCOPE)

        expect(node.map(a => a.assetId)).toEqual([USDC])
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('rejects when the backend fails', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, assets: 503 }),
        )
        const ops = createEthereumAssetOps(
            testChainContext({ services: ['assets'] }),
            memoryPersistence().persistence,
        )

        await expect(ops.syncAssets([USDC], SCOPE)).rejects.toThrow()
    })
})
