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

import { describe, it, test, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    fromClients: vi.fn(),
    registerErrorTransformer: vi.fn(),
    getNetworkConfig: vi.fn(),
    getNetwork: vi.fn(),
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
    // Real 4-network union. The subscription under test (module-level, at
    // the bottom of algorandClient.ts) iterates Object.values(Networks)
    // unconditionally, so it needs a real-shaped Networks map, not just a
    // getNetworkConfig stub.
    Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
        betanet: 'betanet',
        custom: 'custom',
    },
}))

// Only updateNodeEndpoints is swapped out — everything else (registerStore,
// logger, etc., which the real '../../store' barrel needs at import time)
// stays real via importOriginal, or the store import below would crash. This
// also keeps algorandClient.ts's module-level subscription/deferred push
// from building real ky clients as a side effect of the tests in this file.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    updateNodeEndpoints: mocks.updateNodeEndpoints,
}))

// Only useNetworkStore is swapped out — useCustomNetworkStore stays the REAL
// store: algorandClient.ts subscribes to it as a module-level side effect at
// import time below (needs a real `.subscribe`), and the resolveChainEndpoints
// tests further down need a real store to write into.
vi.mock('../../store', async importOriginal => ({
    ...(await importOriginal<typeof import('../../store')>()),
    useNetworkStore: { getState: () => ({ network: mocks.getNetwork() }) },
}))

vi.mock('../../errors', () => ({ toAlgodError: mocks.toAlgodError }))

import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useCustomNetworkStore } from '../../store'
import { getAlgorandClient, resolveChainEndpoints } from '../algorandClient'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromClients.mockReturnValue({
        registerErrorTransformer: mocks.registerErrorTransformer,
    })
    // getNetworkConfig's mock implementation MUST be (re-)established before
    // resetState() below: useCustomNetworkStore.subscribe(...) in
    // algorandClient.ts fires SYNCHRONOUSLY on resetState/setCustomNetwork,
    // which synchronously calls resolveChainEndpoints -> getNetworkConfig()
    // for every network. Clearing the mock's calls (vi.clearAllMocks, above)
    // doesn't touch its implementation, but the very first run in this file
    // has none yet — if resetState() below ran first, that first subscriber
    // firing would call a bare `vi.fn()` returning undefined and throw
    // ("Cannot read properties of undefined") inside beforeEach itself,
    // which then fails every subsequent test too (the throw stops this
    // function before it ever reaches this mockImplementation call).
    mocks.getNetworkConfig.mockImplementation((network: string) =>
        network === 'custom'
            ? // Mirrors the real, deliberately-empty `custom` placeholder in
              // network-config.ts — config cannot read the custom-network
              // store, so its baked entry for `custom` has nothing baked in.
              {
                  algodUrl: '',
                  indexerUrl: '',
                  algodToken: '',
                  indexerToken: '',
              }
            : {
                  algodUrl: `https://algod.${network}`,
                  indexerUrl: `https://indexer.${network}`,
                  algodToken: `algod-token-${network}`,
                  indexerToken: `indexer-token-${network}`,
              },
    )
    mocks.getNetwork.mockReturnValue('mainnet')
    mocks.Algodv2.mockImplementation(function Algodv2() {})
    mocks.Indexer.mockImplementation(function Indexer() {})
    mocks.TimeoutHttpClient.mockImplementation(function TimeoutHttpClient() {})
    // Safe now that getNetworkConfig has a real implementation above.
    useCustomNetworkStore.getState().resetState()
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

    it('omits the auth header entirely for a network with an empty token, rather than sending an empty value', () => {
        // betanet/custom deliberately carry an empty algodToken/indexerToken
        // (see network-config.ts — their algod/indexer are public
        // third-party endpoints Pera does not control). TimeoutHttpClient
        // must never receive an empty-string credential header.
        mocks.getNetworkConfig.mockImplementation((network: string) => ({
            algodUrl: `https://algod.${network}`,
            indexerUrl: `https://indexer.${network}`,
            algodToken: '',
            indexerToken: '',
        }))

        getAlgorandClient('betanet')

        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            {},
            'https://algod.betanet',
            undefined,
            10_000,
            30_000,
        )
        expect(mocks.TimeoutHttpClient).toHaveBeenCalledWith(
            {},
            'https://indexer.betanet',
            undefined,
            10_000,
            30_000,
        )
    })
})

describe('resolveChainEndpoints', () => {
    test('custom endpoints come from the custom-network store', () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            algodToken: 'a'.repeat(64),
            indexerUrl: 'http://10.0.0.5:8980',
            indexerToken: 'a'.repeat(64),
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(resolveChainEndpoints(Networks.custom)).toEqual({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            algodToken: 'a'.repeat(64),
            indexerToken: 'a'.repeat(64),
        })
    })

    test('an unconfigured custom slot yields the empty placeholder', () => {
        useCustomNetworkStore.getState().resetState()

        expect(resolveChainEndpoints(Networks.custom).algodUrl).toBe('')
    })

    test('the three real networks ignore the custom store entirely', () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'x',
        })

        for (const network of [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ] as const) {
            expect(resolveChainEndpoints(network).algodUrl).toBe(
                getNetworkConfig(network).algodUrl,
            )
        }
    })
})
