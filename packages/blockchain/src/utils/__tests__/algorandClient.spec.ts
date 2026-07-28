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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    fromClients: vi.fn(),
    registerErrorTransformer: vi.fn(),
    getNetworkConfig: vi.fn(),
    getNetwork: vi.fn(),
    getNodeEndpointOverride: vi.fn(),
    subscribe: vi.fn(),
    updateNodeEndpoints: vi.fn(),
    toAlgodError: vi.fn((e: unknown) => e),
    Algodv2: vi.fn(),
    Indexer: vi.fn(),
    TimeoutHttpClient: vi.fn(),
}))

vi.mock('@algorandfoundation/algokit-utils', () => ({
    AlgorandClient: { fromClients: mocks.fromClients },
}))

vi.mock('algosdk', () => ({
    Algodv2: mocks.Algodv2,
    Indexer: mocks.Indexer,
}))

vi.mock('../TimeoutHttpClient', () => ({
    TimeoutHttpClient: mocks.TimeoutHttpClient,
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        // Legacy global fields. No production code reads these anymore
        // (see createAlgorandClient.ts) — kept here, deliberately DIFFERENT
        // from the getNetworkConfig-sourced tokens below, as a trap: if a
        // regression reverted createTimeoutBoundedAlgorandClient to read
        // these globals instead of the per-network config it was given, the
        // header assertions below would observe THESE values and fail.
        algodApiKey: 'ALGOD_KEY',
        indexerApiKey: 'INDEXER_KEY',
        algodReadTimeout: 10_000,
        algodSubmitTimeout: 30_000,
    },
    getNetworkConfig: mocks.getNetworkConfig,
    // Real 5-network union. The subscription under test iterates
    // Object.values(Networks) unconditionally (not the override keys), so it
    // needs a real-shaped Networks map, not just a getNetworkConfig stub.
    Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
        betanet: 'betanet',
        fnet: 'fnet',
        localnet: 'localnet',
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    updateNodeEndpoints: mocks.updateNodeEndpoints,
}))

vi.mock('../../store', () => ({
    useNetworkStore: { getState: () => ({ network: mocks.getNetwork() }) },
    getNodeEndpointOverride: mocks.getNodeEndpointOverride,
    useNodeOverrideStore: { subscribe: mocks.subscribe },
}))

vi.mock('../../errors', () => ({ toAlgodError: mocks.toAlgodError }))

import { getAlgorandClient } from '../algorandClient'

// algorandClient.ts subscribes to the override store as a module-level side
// effect, once, during the `import` above. `beforeEach` below calls
// `vi.clearAllMocks()`, which wipes `mocks.subscribe.mock.calls` before any
// test body runs — so the registered callback has to be captured here, right
// after import, or it is unreachable from every test. It takes no argument:
// the subscription iterates all networks unconditionally rather than reading
// the notified state (see the "node-override store subscription" describe
// block below for why).
const nodeOverrideSubscriber = mocks.subscribe.mock.calls[0]?.[0] as () => void

beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromClients.mockReturnValue({
        registerErrorTransformer: mocks.registerErrorTransformer,
    })
    mocks.getNetworkConfig.mockImplementation((network: string) => ({
        algodUrl: `https://algod.${network}`,
        indexerUrl: `https://indexer.${network}`,
        algodToken: `algod-token-${network}`,
        indexerToken: `indexer-token-${network}`,
    }))
    mocks.getNetwork.mockReturnValue('mainnet')
    mocks.getNodeEndpointOverride.mockReturnValue(undefined)
    mocks.Algodv2.mockImplementation(function Algodv2() {})
    mocks.Indexer.mockImplementation(function Indexer() {})
    mocks.TimeoutHttpClient.mockImplementation(function TimeoutHttpClient() {})
})

describe('getAlgorandClient', () => {
    it('builds algod and indexer via TimeoutHttpClient seeded with the configured timeouts', () => {
        getAlgorandClient()

        expect(mocks.getNetworkConfig).toHaveBeenCalledWith('mainnet')

        // algod transport: read + submit ceilings from config, token from
        // the per-network chain config (not the legacy config.algodApiKey).
        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            { 'X-Algo-API-Token': 'algod-token-mainnet' },
            'https://algod.mainnet',
            undefined,
            10_000,
            30_000,
        )
        // indexer transport.
        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            { 'X-Indexer-API-Token': 'indexer-token-mainnet' },
            'https://indexer.mainnet',
            undefined,
            10_000,
            30_000,
        )
    })

    it('constructs Algodv2/Indexer with the timeout transport and their servers, then AlgorandClient.fromClients', () => {
        getAlgorandClient()

        const algodTransport = mocks.TimeoutHttpClient.mock.instances[0]
        const indexerTransport = mocks.TimeoutHttpClient.mock.instances[1]

        expect(mocks.Algodv2).toHaveBeenCalledWith(
            algodTransport,
            'https://algod.mainnet',
        )
        expect(mocks.Indexer).toHaveBeenCalledWith(
            indexerTransport,
            'https://indexer.mainnet',
        )

        expect(mocks.fromClients).toHaveBeenCalledWith({
            algod: mocks.Algodv2.mock.instances[0],
            indexer: mocks.Indexer.mock.instances[0],
        })
    })

    it('uses the network override instead of the store network', () => {
        getAlgorandClient('testnet')

        expect(mocks.getNetworkConfig).toHaveBeenCalledWith('testnet')
        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            { 'X-Algo-API-Token': 'algod-token-testnet' },
            'https://algod.testnet',
            undefined,
            10_000,
            30_000,
        )
    })

    it('applies a node-override URL while keeping the chain config token', () => {
        mocks.getNodeEndpointOverride.mockReturnValue({
            algodUrl: 'http://10.0.0.5:4001',
        })

        getAlgorandClient()

        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            { 'X-Algo-API-Token': 'algod-token-mainnet' },
            'http://10.0.0.5:4001',
            undefined,
            10_000,
            30_000,
        )
        // indexer has no override entry set above, so it still falls back
        // to the baked chain config's URL.
        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            { 'X-Indexer-API-Token': 'indexer-token-mainnet' },
            'https://indexer.mainnet',
            undefined,
            10_000,
            30_000,
        )
    })

    it('registers an error transformer and returns the built client', () => {
        const client = getAlgorandClient()

        expect(mocks.registerErrorTransformer).toHaveBeenCalledTimes(1)
        expect(client).toBe(mocks.fromClients.mock.results[0].value)
    })

    it('the registered transformer routes errors through toAlgodError', async () => {
        getAlgorandClient()

        const transformer = mocks.registerErrorTransformer.mock.calls[0][0] as (
            error: unknown,
        ) => Promise<unknown>
        const error = new Error('boom')
        const result = await transformer(error)

        expect(mocks.toAlgodError).toHaveBeenCalledWith(error)
        expect(result).toBe(error)
    })
})

describe('node-override store subscription', () => {
    // Deliberately does NOT branch on which networks have an override key —
    // clearOverride/resetState DELETE the key, so a keys-only loop would
    // never re-sync a cleared network back to baked config (see the
    // "clearing an override" test in createAlgorandClient.spec.ts for the
    // end-to-end proof of that regression). Instead it pushes every network
    // on every notification; resolveChainEndpoints itself decides per
    // network whether an override applies.
    it('pushes resolved endpoints for every network unconditionally, not just ones with an override key', () => {
        mocks.getNodeEndpointOverride.mockImplementation((network: string) =>
            network === 'localnet'
                ? { algodUrl: 'http://overridden-algod' }
                : undefined,
        )

        nodeOverrideSubscriber()

        expect(mocks.updateNodeEndpoints).toHaveBeenCalledTimes(5)
        // The one network with an override gets its overridden URL.
        expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith('localnet', {
            algodUrl: 'http://overridden-algod',
            indexerUrl: 'https://indexer.localnet',
            algodToken: 'algod-token-localnet',
            indexerToken: 'indexer-token-localnet',
        })
        // Every other network still gets pushed, with its baked config.
        for (const network of ['mainnet', 'testnet', 'betanet', 'fnet']) {
            expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(network, {
                algodUrl: `https://algod.${network}`,
                indexerUrl: `https://indexer.${network}`,
                algodToken: `algod-token-${network}`,
                indexerToken: `indexer-token-${network}`,
            })
        }
    })
})
