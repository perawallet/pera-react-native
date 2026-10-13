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

import { describe, test, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    resetNodeClients: vi.fn(),
}))

// Partial mock: only resetNodeClients is swapped out. Everything else
// (registerStore, logger, etc., which the network store needs at import time)
// stays real via importOriginal, or the store import below would crash.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    resetNodeClients: mocks.resetNodeClients,
}))

// Spy on createTimeoutBoundedAlgorandClient while still delegating to the
// real implementation, so getAlgorandClient's assertions below can inspect
// what it was called with without breaking the real chain through to it.
vi.mock('../createAlgorandClient', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../createAlgorandClient')>()
    return {
        ...actual,
        createTimeoutBoundedAlgorandClient: vi.fn(
            actual.createTimeoutBoundedAlgorandClient,
        ),
    }
})

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    Networks,
    getChainConfig,
    getNetworkConfig,
} from '@perawallet/wallet-core-config'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { setCustomNetwork, clearCustomNetwork } from '../../store'
import { getAlgorandClient } from '../algorandClient'
import { createTimeoutBoundedAlgorandClient } from '../createAlgorandClient'
import { algorandNodeBackends } from '../../node-backends'

const CUSTOM_SCOPE = scopeForLegacyNetwork(Networks.custom)

describe('getChainConfig for the custom network (real store, end-to-end)', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    test('an unconfigured custom slot resolves to the empty placeholder', () => {
        expect(getChainConfig(CUSTOM_SCOPE)).toStrictEqual({
            algodUrl: '',
            indexerUrl: '',
            genesisHash: '',
            genesisId: '',
            explorerUrl: '',
            algodToken: '',
            indexerToken: '',
            dispenserUrl: '',
        })
    })

    test("a saved node resolves through the store's registered source", () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(getChainConfig(CUSTOM_SCOPE)).toStrictEqual({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
            explorerUrl: '',
            // No token saved, so none is sent — never `undefined`.
            algodToken: '',
            indexerToken: '',
            dispenserUrl: '',
        })
    })

    test('carries the saved tokens, which have no baked counterpart to fall back to', () => {
        // AlgoKit LocalNet — the primary reason the custom slot exists —
        // rejects every request without this exact 64-char token. `custom`'s
        // baked entry is `''` by design, so the store is the ONLY source: if
        // these are dropped anywhere between here and the ky client, indexer
        // history and asset lookups 401 while balance reads keep working.
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            algodToken: 'a'.repeat(64),
            indexerUrl: 'http://10.0.0.5:8980',
            indexerToken: 'a'.repeat(64),
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(getChainConfig(CUSTOM_SCOPE)).toMatchObject({
            algodToken: 'a'.repeat(64),
            indexerToken: 'a'.repeat(64),
        })
    })

    test('getNetworkConfig serves the saved node for custom', () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(getNetworkConfig(Networks.custom)).toMatchObject({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
            algodToken: '',
            indexerToken: '',
        })
    })

    test('the baked networks ignore the saved node', () => {
        const bakedNetworks = [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ] as const
        const before = bakedNetworks.map(network =>
            getChainConfig(scopeForLegacyNetwork(network)),
        )

        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'x',
        })

        expect(
            bakedNetworks.map(network =>
                getChainConfig(scopeForLegacyNetwork(network)),
            ),
        ).toStrictEqual(before)
    })

    test('clearing the saved node restores the placeholder', () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        clearCustomNetwork()

        expect(getChainConfig(CUSTOM_SCOPE).algodUrl).toBe('')
    })

    test('getAlgorandClient builds against the saved node', () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        getAlgorandClient(Networks.custom)

        expect(createTimeoutBoundedAlgorandClient).toHaveBeenLastCalledWith(
            expect.objectContaining({
                algodUrl: 'http://10.0.0.5:4001',
                indexerUrl: 'http://10.0.0.5:8980',
            }),
        )
    })
})

describe('custom-network store subscription (real store, end-to-end)', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
        mocks.resetNodeClients.mockClear()
    })

    test('saving a custom config drops the cached node clients, and the custom backends read the saved node', () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(mocks.resetNodeClients).toHaveBeenCalled()
        expect(algorandNodeBackends.backendsFor(CUSTOM_SCOPE)).toEqual({
            algod: {
                url: 'http://10.0.0.5:4001',
                tokenHeader: 'X-Algo-API-Token',
                // No token saved, so the store's source reports none.
                token: '',
            },
            indexer: {
                url: 'http://10.0.0.5:8980',
                tokenHeader: 'X-Indexer-API-Token',
                token: '',
            },
        })
    })

    test('clearing the custom config drops them again, back to the empty baked placeholder', () => {
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })
        mocks.resetNodeClients.mockClear()

        clearCustomNetwork()

        expect(mocks.resetNodeClients).toHaveBeenCalled()
        expect(algorandNodeBackends.backendsFor(CUSTOM_SCOPE).algod?.url).toBe(
            getNetworkConfig(Networks.custom).algodUrl,
        )
    })
})

describe('a persisted custom config on module load', () => {
    // Last in this file: it calls vi.resetModules() and re-imports, which the
    // describe blocks above must not see.
    test('reaches the node backends with no store write in this test', async () => {
        vi.resetModules()

        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        // A previous session's legacy custom-network record, already on disk
        // before the module loads; the network store folds it in on hydrate.
        getProvider().keyValueStorage.setItem(
            'custom-network-store',
            JSON.stringify({
                state: {
                    customNetwork: {
                        algodUrl: 'http://10.0.0.9:4001',
                        indexerUrl: 'http://10.0.0.9:8980',
                        genesisHash: 'HASH',
                        genesisId: 'dockernet-v1',
                    },
                },
                version: 1,
            }),
        )

        // algorandClient registers the saved-node reader node-backends reads.
        await import('../algorandClient')
        const { algorandNodeBackends: fresh } =
            await import('../../node-backends')

        expect(fresh.backendsFor(CUSTOM_SCOPE).algod?.url).toBe(
            'http://10.0.0.9:4001',
        )
    })
})
