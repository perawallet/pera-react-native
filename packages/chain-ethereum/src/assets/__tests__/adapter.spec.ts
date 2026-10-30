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
    vi,
} from 'vitest'
import { getAddress } from 'viem'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
    AssetRef,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getStaleOrMissingAssetIds,
    upsertAssets,
    upsertNodeAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { isAssetSearchUnavailableError } from '@perawallet/wallet-core-assets'
import {
    isChainRefusedError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import { createEthereumAssetsAdapter } from '../adapter'
import {
    eip155IdOf,
    ETHEREUM,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'

import { ASSETS_PATH } from '../api/endpoints'
import type { AssetItemResponse, WhitelistItemResponse } from '../api/schema'
import {
    evmNftItem,
    nativeWhitelistItem,
    peraEvmAssetHandlers,
    unknownAssetItem,
} from '../api/msw-handlers'
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

const ETHEREUM_NATIVE_ASSET = ETHEREUM.nativeAsset

const repository = vi.hoisted(() => ({
    stale: (ids: string[]): string[] => ids,
    node: [] as PeraAsset[],
    full: [] as PeraAsset[],
    cached: null as PeraAsset | null,
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    getAssetById: vi.fn(async () => repository.cached),
    getStaleOrMissingAssetIds: vi.fn(
        async ({ assetIds }: { assetIds: string[] }) =>
            repository.stale(assetIds),
    ),
    upsertAssets: vi.fn(async ({ items }: { items: PeraAsset[] }) => {
        repository.full.push(...items)
    }),
    upsertNodeAssets: vi.fn(async ({ items }: { items: PeraAsset[] }) => {
        repository.node.push(...items)
    }),
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['nfts'],
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
    repository.stale = stale
    return {
        persistence: {
            getStaleOrMissingAssetIds,
            upsertAssets,
            upsertNodeAssets,
        },
        node: repository.node,
        full: repository.full,
    }
}

const ref = (assetId: string): AssetRef => ({ chainId: 'ethereum', assetId })

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    repository.stale = ids => ids
    repository.node.length = 0
    repository.full.length = 0
    repository.cached = null
    vi.mocked(getStaleOrMissingAssetIds).mockClear()
    vi.mocked(upsertAssets).mockClear()
    vi.mocked(upsertNodeAssets).mockClear()
})
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

describe('getAssetMetadata', () => {
    it("keeps the chain's name, symbol, decimals and supply over the backend's", async () => {
        server.use(
            ...rpc({ [USDC]: usdcOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [USDC_CAIP19]: usdcFromPera },
            }),
        )
        const { node } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        const asset = await ops.getAssetMetadata(ref(USDC), SCOPE)

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
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(
            ops.getAssetMetadata(ref(USDC), SCOPE),
        ).resolves.toMatchObject({
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
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(USDC), SCOPE)).rejects.toThrow()
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
    })

    it('rejects when the chain fails and the backend does not know the token', async () => {
        server.use(
            ...rpc({}),
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL }),
        )
        const { persistence } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(USDC), SCOPE)).rejects.toThrow()
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
        const { node, full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        const asset = await ops.getAssetMetadata(ref(DAI), SCOPE)

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
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(DAI), SCOPE)).rejects.toThrow()
        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('rejects the zero address without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(ZERO), SCOPE)).rejects.toThrow()
        expect(requests).toEqual([])
    })

    it('rejects an id that is not an address without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(
            ops.getAssetMetadata(ref('not-an-address'), SCOPE),
        ).rejects.toThrow()
        expect(requests).toEqual([])
    })

    it('returns the native asset without a request', async () => {
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(
            ops.getAssetMetadata(ref(ETHEREUM_NATIVE_ASSET.assetId), SCOPE),
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
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets(
            [ETHEREUM_NATIVE_ASSET.assetId, USDC, DAI].map(ref),
            SCOPE,
        )

        expect(persistence.getStaleOrMissingAssetIds).toHaveBeenCalledWith(
            expect.objectContaining({ assetIds: [USDC, DAI] }),
        )
        expect(requested).toEqual([{ ids: [USDC_CAIP19] }])
        expect(full.map(a => a.assetId)).toEqual([USDC])
    })

    it('checks staleness under the checksummed id', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([USDC.toLowerCase()].map(ref), SCOPE)

        expect(persistence.getStaleOrMissingAssetIds).toHaveBeenCalledWith(
            expect.objectContaining({ assetIds: [USDC] }),
        )
    })

    it('drops ids that are not addresses without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets(['not-an-address'].map(ref), SCOPE)

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
        const { node, full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([USDC, DAI].map(ref), SCOPE)

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
        const { node, full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([USDC, DAI].map(ref), SCOPE)

        expect(full.map(a => a.assetId)).toEqual([USDC])
        expect(node.map(a => a.assetId)).toEqual([DAI])
    })

    it('stores nothing for a token whose backend row it cannot read', async () => {
        server.use(
            ...rpc({ [DAI]: usdcOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: {
                    [USDC_CAIP19]: usdcFromPera,
                    [DAI_CAIP19]: {
                        ...unknownAssetItem(DAI_CAIP19),
                        usd_value: '1.5',
                    },
                },
            }),
        )
        const { node, full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([USDC, DAI].map(ref), SCOPE)

        expect(full.map(a => a.assetId)).toEqual([USDC])
        expect(node).toEqual([])
    })

    it('persists a quarantined token as suspicious with its on-chain intrinsics', async () => {
        server.use(
            ...rpc({ [DAI]: daiOnChain }),
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
        )
        const { node, full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([DAI].map(ref), SCOPE)

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
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([DAI].map(ref), SCOPE)

        expect(persistence.upsertNodeAssets).not.toHaveBeenCalled()
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('drops the zero address, which the backend rejects', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([ZERO, USDC].map(ref), SCOPE)

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
        const { full } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets(ids.map(ref), SCOPE)

        expect(batchSizes).toEqual([500, 1])
        expect(full).toHaveLength(501)
    })

    it('makes no request when nothing is stale', async () => {
        const { persistence } = memoryPersistence(() => [])
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await ops.syncAssets([USDC].map(ref), SCOPE)

        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('reads the chain without the assets service and leaves failed tokens out', async () => {
        server.use(...rpc({ [USDC]: usdcOnChain }))
        const { persistence, node } = memoryPersistence()
        const ops = createEthereumAssetsAdapter(testChainContext(), ETHEREUM)

        await ops.syncAssets([USDC, DAI].map(ref), SCOPE)

        expect(node.map(a => a.assetId)).toEqual([USDC])
        expect(persistence.upsertAssets).not.toHaveBeenCalled()
    })

    it('rejects when the backend fails', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, assets: 503 }),
        )
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(ops.syncAssets([USDC].map(ref), SCOPE)).rejects.toThrow()
    })
})

describe('prices', () => {
    const ETH_CAIP19 = 'eip155:1/slip44:60'
    const priced = (usdValue: string | null) => ({
        ...usdcFromPera,
        usd_value: usdValue,
    })
    const pricedServices = ['assets', 'prices']
    const ref = (assetId: string) => ({ chainId: 'ethereum', assetId }) as const
    const ETH = ref(ETHEREUM_NATIVE_ASSET.assetId)

    it('reads USD prices from the v4 asset items, leaving an unpriced id out', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: {
                    [USDC_CAIP19]: priced('1.000100000000000000000000'),
                    [DAI_CAIP19]: { ...priced(null), asset_id: DAI_CAIP19 },
                },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )

        const prices = await adapter.getPrices([ref(USDC), ref(DAI)], SCOPE)

        expect(
            prices.map(p => [p.assetRef.assetId, p.usdPrice.toFixed()]),
        ).toEqual([[USDC, '1.0001']])
    })

    it('prices the readable rows when another row in the request is unreadable', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: {
                    [USDC_CAIP19]: priced('1.000100000000000000000000'),
                    [DAI_CAIP19]: {
                        ...priced('1.0'),
                        asset_id: DAI_CAIP19,
                    },
                },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )

        const prices = await adapter.getPrices([ref(USDC), ref(DAI)], SCOPE)

        expect(
            prices.map(p => [p.assetRef.assetId, p.usdPrice.toFixed()]),
        ).toEqual([[USDC, '1.0001']])
    })

    it('keys a price by the ref it was asked for, whatever its address case', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: { [USDC_CAIP19]: priced('1.000100000000000000000000') },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )
        const lower = ref(USDC.toLowerCase())

        const prices = await adapter.getPrices([lower], SCOPE)

        expect(prices.map(p => p.assetRef)).toEqual([lower])
    })

    it('drops ids that are not tokens before the request', async () => {
        const requested: unknown[] = []
        server.use(
            http.post(`${TEST_PERA_URL}${ASSETS_PATH}`, async ({ request }) => {
                requested.push(await request.json())
                return HttpResponse.json({
                    results: [{ ...priced('2.000000000000000000000000') }],
                })
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )

        await adapter.getPrices(
            [ref(USDC), ref(ZERO), ref('not-an-address')],
            SCOPE,
        )

        expect(requested).toEqual([{ ids: [USDC_CAIP19] }])
    })

    it.each([
        ['the prices service', ['assets']],
        ['the assets service', ['prices']],
    ])(
        'reports every id as a miss without a request on a scope without %s',
        async (_, services) => {
            const requests = recordRequests()
            const adapter = createEthereumAssetsAdapter(
                testChainContext({ services }),
                ETHEREUM,
            )

            await expect(
                adapter.getPrices([ref(USDC), ETH], SCOPE),
            ).resolves.toEqual([])
            expect(requests).toEqual([])
        },
    )

    it('reads the ETH price from its slip44 item', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                assets: {
                    [ETH_CAIP19]: {
                        ...unknownAssetItem(ETH_CAIP19),
                        usd_value: '2500.120000000000000000000000',
                    },
                },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )

        const [price] = await adapter.getPrices([ETH], SCOPE)

        expect(price?.assetRef).toEqual(ETH)
        expect(price?.usdPrice.toFixed()).toBe('2500.12')
    })

    it('leaves an unpriced ETH out rather than pricing it 0', async () => {
        server.use(...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL }))
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: pricedServices }),
            ETHEREUM,
        )

        await expect(adapter.getPrices([ETH], SCOPE)).resolves.toEqual([])
    })

    it('takes at most one backend request worth of ids per price call', () => {
        expect(
            createEthereumAssetsAdapter(testChainContext(), ETHEREUM)
                .maxPriceIdsPerRequest,
        ).toBe(500)
    })
})

describe('price history', () => {
    const ETH_CAIP19 = 'eip155:1/slip44:60'
    const ETH = ref(ETHEREUM_NATIVE_ASSET.assetId)
    const point = (datetime: string, price: string) => ({ datetime, price })

    it('reads the token chart by its CAIP-19 id and period, keeping every digit', async () => {
        const urls = recordRequests()
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                charts: {
                    [USDC_CAIP19]: [
                        point(
                            '2026-10-20T15:00:00Z',
                            '0.999800000000000000000001',
                        ),
                        point(
                            '2026-10-21T14:03:11Z',
                            '1.000100000000000000000000',
                        ),
                    ],
                },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['prices'] }),
            ETHEREUM,
        )

        const points = await adapter.getPriceHistory!(
            ref(USDC),
            'one-day',
            SCOPE,
        )

        expect(
            points.map(p => [
                new Date(p.timestamp).toISOString(),
                p.usdPrice.toFixed(),
            ]),
        ).toEqual([
            ['2026-10-20T15:00:00.000Z', '0.999800000000000000000001'],
            ['2026-10-21T14:03:11.000Z', '1.0001'],
        ])
        const params = new URL(urls[0]!).searchParams
        expect(params.get('id')).toBe(USDC_CAIP19)
        expect(params.get('period')).toBe('one-day')
    })

    it('asks for ETH by its slip44 id', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                charts: {
                    [ETH_CAIP19]: [
                        point(
                            '2026-10-21T14:03:11Z',
                            '2500.120000000000000000000000',
                        ),
                    ],
                },
            }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['prices'] }),
            ETHEREUM,
        )

        const [latest] = await adapter.getPriceHistory!(ETH, 'one-week', SCOPE)

        expect(latest?.usdPrice.toFixed()).toBe('2500.12')
    })

    it('answers no points for a token the backend has no chart for', async () => {
        server.use(...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL }))
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['prices'] }),
            ETHEREUM,
        )

        await expect(
            adapter.getPriceHistory!(ref(USDC), 'one-day', SCOPE),
        ).resolves.toEqual([])
    })

    it('rejects on any other failure, so the chart can offer a retry', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, charts: 503 }),
        )
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['prices'] }),
            ETHEREUM,
        )

        await expect(
            adapter.getPriceHistory!(ref(USDC), 'one-day', SCOPE),
        ).rejects.toThrow()
    })

    it('answers no points without a request on a scope without the prices service', async () => {
        const requests = recordRequests()
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(
            adapter.getPriceHistory!(ETH, 'one-day', SCOPE),
        ).resolves.toEqual([])
        expect(requests).toEqual([])
    })
})

describe('optional members', () => {
    it('declares no authorities, since ERC-20 has no freeze or clawback', () => {
        const adapter = createEthereumAssetsAdapter(
            testChainContext(),
            ETHEREUM,
        )

        expect(adapter.fetchAssetAuthorities).toBeUndefined()
    })
})

describe('search', () => {
    const listed = (
        address: string,
        name: string,
        unitName: string,
    ): WhitelistItemResponse => ({
        ...unknownAssetItem(`eip155:1/erc20:${address.toLowerCase()}`),
        type: 'erc20',
        name,
        unit_name: unitName,
        fraction_decimals: 6,
        logo: `https://pera.test/${unitName}.png`,
        is_verified: true,
        verification_tier: 'verified',
        is_swappable: true,
        is_fundable: false,
    })
    const whitelist = {
        1: [
            nativeWhitelistItem(1),
            listed(USDC, 'USD Coin', 'USDC'),
            listed(DAI, 'Dai Stablecoin', 'DAI'),
        ],
    }
    const searchWith = (
        query: string,
        { hasCollectible = false, services = ['assets'] } = {},
    ) => {
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services }),
            ETHEREUM,
        )
        return adapter.search!({ query, hasCollectible }, SCOPE)
    }

    it("lists the native coin first, then the backend's listed tokens, in one page", async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
        )

        const page = await searchWith('')

        expect(page.results.map(asset => asset.assetId)).toEqual([
            ETHEREUM_NATIVE_ASSET.assetId,
            USDC,
            DAI,
        ])
        expect(page.nextCursor).toBeUndefined()
    })

    it('reads the token list once for the searches that follow within its window', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
        )
        const requests = recordRequests()
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await adapter.search!({ query: 'u' }, SCOPE)
        await adapter.search!({ query: 'us' }, SCOPE)
        await adapter.search!({ query: 'usd' }, SCOPE)

        expect(requests).toHaveLength(1)
    })

    it('searches the token list it was handed, which account sync shares', async () => {
        const requests = recordRequests()
        const listedTokens = vi.fn(async () => [
            {
                assetId: DAI,
                type: 'erc20' as const,
                asset: {
                    assetId: DAI,
                    name: 'Dai Stablecoin',
                    unitName: 'DAI',
                },
            },
        ])
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
            listedTokens,
        )

        const page = await adapter.search!({ query: 'dai' }, SCOPE)

        expect(page.results.map(asset => asset.assetId)).toEqual([DAI])
        expect(listedTokens).toHaveBeenCalledWith(SCOPE)
        expect(requests).toEqual([])
    })

    it('matches the name or symbol whatever the case', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
        )

        const byName = await searchWith('stablecoin')
        const bySymbol = await searchWith(' eth ')

        expect(byName.results.map(asset => asset.assetId)).toEqual([DAI])
        expect(bySymbol.results.map(asset => asset.assetId)).toEqual([
            ETHEREUM_NATIVE_ASSET.assetId,
        ])
    })

    it('matches a contract address by its start, whatever the case', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
        )

        const full = await searchWith(USDC.toLowerCase())
        const prefix = await searchWith('0x6b17')
        const middle = await searchWith('6eb48')

        expect(full.results.map(asset => asset.assetId)).toEqual([USDC])
        expect(prefix.results.map(asset => asset.assetId)).toEqual([DAI])
        expect(middle.results).toEqual([])
    })

    it('names the native coin from the chain, not the token list', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                whitelist: {
                    1: [{ ...nativeWhitelistItem(1), name: 'Ethereum' }],
                },
            }),
        )

        const page = await searchWith('')

        expect(page.results[0]).toMatchObject({
            name: ETHEREUM_NATIVE_ASSET.name,
            unitName: ETHEREUM_NATIVE_ASSET.unitName,
        })
    })

    it('reads a pasted contract address the list lacks from the chain', async () => {
        const UNLISTED = '0x00000000000000000000000000000000000000Ab'
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
            ...rpc({
                [getAddress(UNLISTED)]: {
                    name: 'Fresh Token',
                    symbol: 'FRSH',
                    decimals: 8,
                    totalSupply: 10n ** 12n,
                    balances: {},
                },
            }),
        )

        const page = await searchWith(UNLISTED.toLowerCase())

        expect(page.results).toEqual([
            expect.objectContaining({
                assetId: getAddress(UNLISTED),
                unitName: 'FRSH',
                peraMetadata: expect.objectContaining({
                    verificationTier: 'unverified',
                }),
            }),
        ])
    })

    it('reports a pasted quarantined address as suspicious, caching nothing', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                whitelist: {
                    1: [
                        nativeWhitelistItem(1),
                        listed(USDC, 'USD Coin', 'USDC'),
                    ],
                },
                assets: { [DAI_CAIP19]: quarantinedDai },
            }),
            ...rpc({ [DAI]: daiOnChain }),
        )
        const { node, full } = memoryPersistence()

        const page = await searchWith(DAI.toLowerCase())

        expect(page.results).toEqual([
            expect.objectContaining({
                assetId: DAI,
                peraMetadata: expect.objectContaining({
                    verificationTier: 'suspicious',
                }),
            }),
        ])
        expect(node).toEqual([])
        expect(full).toEqual([])
    })

    it('finds nothing for a pasted address that is not a token', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist }),
            ...rpc({}),
        )

        const page = await searchWith(
            '0x00000000000000000000000000000000000000cd',
        )

        expect(page.results).toEqual([])
    })

    it('finds nothing for an NFT search, without a request', async () => {
        const requests = recordRequests()

        const page = await searchWith('', { hasCollectible: true })

        expect(page).toEqual({ results: [], nextCursor: undefined })
        expect(requests).toEqual([])
    })

    it('rejects as unavailable without the assets service, without a request', async () => {
        const requests = recordRequests()

        await expect(
            searchWith('usd', { services: [] }),
        ).rejects.toBeInstanceOf(PeraServiceUnavailableError)
        expect(requests).toEqual([])
    })

    it('rejects when the backend fails', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, whitelist: 503 }),
        )

        await expect(searchWith('usd')).rejects.toThrow()
    })

    it('rejects a scope on another chain before any request', async () => {
        const requests = recordRequests()
        const adapter = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )

        await expect(
            adapter.search!(
                { query: 'usd' },
                { chainId: 'algorand', networkId: 'mainnet' },
            ),
        ).rejects.toThrow()
        expect(requests).toEqual([])
    })
})

describe('foreign scopes and refs', () => {
    const ALGORAND_SCOPE: ChainScope = {
        chainId: 'algorand',
        networkId: 'mainnet',
    }

    it('rejects the native ref on another chain without a request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )
        const native = ref(ETHEREUM_NATIVE_ASSET.assetId)

        await expect(
            ops.getAssetMetadata(native, ALGORAND_SCOPE),
        ).rejects.toThrow()
        await expect(
            ops.fetchOnChainAsset(native, ALGORAND_SCOPE),
        ).rejects.toThrow()
        expect(requests).toEqual([])
    })

    it('rejects a ref on another chain before any request', async () => {
        const requests = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: ['assets'] }),
            ETHEREUM,
        )
        const algorandRef: AssetRef = {
            chainId: 'algorand',
            assetId: '31566704',
        }

        await expect(ops.syncAssets([algorandRef], SCOPE)).rejects.toThrow(
            'Not an asset on Ethereum',
        )
        await expect(ops.getAssetMetadata(algorandRef, SCOPE)).rejects.toThrow(
            'Not an asset on Ethereum',
        )
        expect(requests).toEqual([])
        expect(getStaleOrMissingAssetIds).not.toHaveBeenCalled()
    })
})

describe('NFTs', () => {
    const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
    const APE = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/1234'
    const ERC721_ID = `eip155:1/erc721:${BAYC}/1234`
    const ERC1155_ID = `eip155:1/erc1155:${BAYC}/1234`
    const nftServices = ['assets', 'prices', 'nfts']

    const recordNftIds = (): string[][] => {
        const asked: string[][] = []
        server.events.on('request:start', async ({ request }) => {
            if (!request.url.endsWith('/api/v4/nfts/')) return
            const { ids } = (await request.clone().json()) as { ids: string[] }
            asked.push(ids)
        })
        return asked
    }

    it('asks for both standards when nothing is cached, and stores the answer', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                nfts: { [ERC721_ID]: evmNftItem() },
            }),
        )
        const asked = recordNftIds()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: nftServices }),
            ETHEREUM,
        )

        const asset = await ops.getAssetMetadata(ref(APE), SCOPE)

        expect(asked).toEqual([[ERC721_ID, ERC1155_ID]])
        expect(asset).toMatchObject({
            assetId: APE,
            peraMetadata: { type: 'collectible', isUnique: true },
        })
        expect(repository.full.map(a => a.assetId)).toEqual([APE])
    })

    it("asks for the cached row's standard only", async () => {
        repository.cached = {
            assetId: APE,
            decimals: 0,
            creator: { address: BAYC },
            totalSupply: ETHEREUM_NATIVE_ASSET.totalSupply,
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'verified',
                collectible: { standard: 'erc1155' },
            },
        }
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: TEST_PERA_URL,
                nfts: {
                    [ERC1155_ID]: evmNftItem({
                        asset_id: ERC1155_ID,
                        standard: 'erc1155',
                    }),
                },
            }),
        )
        const asked = recordNftIds()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: nftServices }),
            ETHEREUM,
        )

        const asset = await ops.getAssetMetadata(ref(APE), SCOPE)

        expect(asked).toEqual([[ERC1155_ID]])
        expect(asset.peraMetadata?.isUnique).toBe(false)
    })

    it('falls back to the cached row when the backend fails', async () => {
        const cached: PeraAsset = {
            assetId: APE,
            name: 'Stored ape',
            decimals: 0,
            creator: { address: BAYC },
            totalSupply: ETHEREUM_NATIVE_ASSET.totalSupply,
        }
        repository.cached = cached
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL, nfts: 502 }),
        )
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: nftServices }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(APE), SCOPE)).resolves.toBe(
            cached,
        )
    })

    it('rejects an NFT neither the backend nor the cache knows', async () => {
        server.use(...peraEvmAssetHandlers({ baseUrl: TEST_PERA_URL }))
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: nftServices }),
            ETHEREUM,
        )

        await expect(ops.getAssetMetadata(ref(APE), SCOPE)).rejects.toThrow()
    })

    it('never reads an NFT as an ERC-20 or prices it', async () => {
        const urls = recordRequests()
        const ops = createEthereumAssetsAdapter(
            testChainContext({ services: nftServices }),
            ETHEREUM,
        )

        await expect(ops.fetchOnChainAsset(ref(APE), SCOPE)).rejects.toThrow()
        await expect(ops.getPrices([ref(APE)], SCOPE)).resolves.toEqual([])
        await ops.syncAssets([ref(APE)], SCOPE)

        expect(urls).toEqual([])
    })
})

// The same code serves every EVM chain, so what a tester sees on Base is what
// each of these reads off the wire: the chain's own EIP-155 id in the path, and
// the backend's refusal told apart from a build with no assets service.
describe('search on every EVM chain and network', () => {
    const NETWORKS = EVM_TEST_CHAINS.flatMap(chain =>
        (['mainnet', 'testnet'] as const).map(
            tier => [`${chain.row.id} ${tier}`, chain, tier] as const,
        ),
    )
    const tokenListPath = `${TEST_PERA_URL}/api/v3/evm/:chainId/tokens/`

    it.each(NETWORKS)(
        '%s: reads its own token list by EIP-155 id and filters it as Ethereum does',
        async (_network, chain, tier) => {
            const scope = evmScopeOf(chain, tier)
            const eip155Id = eip155IdOf(chain, tier)
            const requested: string[] = []
            server.use(
                http.get(tokenListPath, ({ params }) => {
                    requested.push(String(params.chainId))
                    return HttpResponse.json({
                        results: [
                            nativeWhitelistItem(eip155Id),
                            {
                                ...unknownAssetItem(
                                    `eip155:${eip155Id}/erc20:${DAI.toLowerCase()}`,
                                ),
                                type: 'erc20',
                                name: 'Dai Stablecoin',
                                unit_name: 'DAI',
                                fraction_decimals: 18,
                                is_swappable: true,
                                is_fundable: false,
                            },
                        ],
                    })
                }),
            )
            const adapter = createEthereumAssetsAdapter(
                testChainContext({ services: ['assets'], chain }),
                chain,
            )

            const page = await adapter.search!(
                { query: 'dai', hasCollectible: false },
                scope,
            )

            expect(requested).toEqual([String(eip155Id)])
            expect(page.results.map(asset => asset.assetId)).toEqual([DAI])
        },
    )

    it.each(
        NETWORKS.flatMap(network =>
            (['chain_not_enabled', 'unknown_chain'] as const).map(
                code => [...network, code] as const,
            ),
        ),
    )(
        '%s: a 422 %s rejects as a chain refusal, which Add Asset words as not listed',
        async (_network, chain, tier, code) => {
            server.use(
                http.get(tokenListPath, () =>
                    HttpResponse.json(
                        { error: 'Chain refused', code },
                        { status: 422 },
                    ),
                ),
            )
            const adapter = createEthereumAssetsAdapter(
                testChainContext({ services: ['assets'], chain }),
                chain,
            )

            const error = await adapter.search!(
                { query: '', hasCollectible: false },
                evmScopeOf(chain, tier),
            ).catch((caught: unknown) => caught)

            expect(isChainRefusedError(error)).toBe(true)
            expect(isAssetSearchUnavailableError(error)).toBe(true)
        },
    )

    it.each(NETWORKS)(
        '%s: a build listing no assets service asks nothing and rejects as a missing service, which keeps the default copy',
        async (_network, chain, tier) => {
            const requested: string[] = []
            server.use(
                http.get(tokenListPath, ({ params }) => {
                    requested.push(String(params.chainId))
                    return HttpResponse.json({ results: [] })
                }),
            )
            const adapter = createEthereumAssetsAdapter(
                testChainContext({ services: [], chain }),
                chain,
            )

            const error = await adapter.search!(
                { query: '', hasCollectible: false },
                evmScopeOf(chain, tier),
            ).catch((caught: unknown) => caught)

            expect(error).toBeInstanceOf(PeraServiceUnavailableError)
            expect(isChainRefusedError(error)).toBe(false)
            expect(isAssetSearchUnavailableError(error)).toBe(true)
            expect(requested).toEqual([])
        },
    )
})
