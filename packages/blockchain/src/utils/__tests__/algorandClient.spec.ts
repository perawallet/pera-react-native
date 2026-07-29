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
}))

vi.mock('../../store', () => ({
    useNetworkStore: { getState: () => ({ network: mocks.getNetwork() }) },
}))

vi.mock('../../errors', () => ({ toAlgodError: mocks.toAlgodError }))

import { getAlgorandClient } from '../algorandClient'

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
        // betanet/fnet deliberately carry an empty algodToken/indexerToken
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
