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
    updateNodeEndpoints: vi.fn(),
}))

// Partial mock: algorandClient.ts's module-level subscription (Step 4) would
// otherwise call the REAL updateNodeEndpoints on every setCustomNetwork/
// clearCustomNetwork/resetState below, building real ky clients as a side
// effect of unrelated tests. Only updateNodeEndpoints is swapped out —
// everything else (registerStore, logger, etc., which ../store's
// custom-network-store.ts needs at import time) stays real via
// importOriginal, or the store import below would crash with "registerStore
// is not a function".
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    updateNodeEndpoints: mocks.updateNodeEndpoints,
}))

import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useCustomNetworkStore } from '../../store'
import { resolveChainEndpoints } from '../algorandClient'

describe('resolveChainEndpoints', () => {
    beforeEach(() => {
        useCustomNetworkStore.getState().resetState()
    })

    test('uses the baked chain config when custom is not configured', () => {
        expect(resolveChainEndpoints(Networks.betanet)).toEqual({
            algodUrl: getNetworkConfig(Networks.betanet).algodUrl,
            indexerUrl: getNetworkConfig(Networks.betanet).indexerUrl,
            algodToken: getNetworkConfig(Networks.betanet).algodToken,
            indexerToken: getNetworkConfig(Networks.betanet).indexerToken,
        })
    })

    test('the custom network resolves from the real custom-network store, end-to-end', () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        const resolved = resolveChainEndpoints(Networks.custom)

        expect(resolved.algodUrl).toBe('http://10.0.0.5:4001')
        expect(resolved.indexerUrl).toBe('http://10.0.0.5:8980')
    })

    test('carries the custom slot tokens, which have no baked counterpart to fall back to', () => {
        // AlgoKit LocalNet — the primary reason the custom slot exists —
        // rejects every request without this exact 64-char token. `custom`'s
        // baked entry is `''` by design, so the store is the ONLY source: if
        // these are dropped anywhere between here and the ky client, indexer
        // history and asset lookups 401 while balance reads keep working.
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            algodToken: 'a'.repeat(64),
            indexerUrl: 'http://10.0.0.5:8980',
            indexerToken: 'a'.repeat(64),
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        const resolved = resolveChainEndpoints(Networks.custom)

        expect(resolved.algodToken).toBe('a'.repeat(64))
        expect(resolved.indexerToken).toBe('a'.repeat(64))
    })
})

describe('custom-network store subscription (real store, end-to-end)', () => {
    beforeEach(() => {
        useCustomNetworkStore.getState().resetState()
        mocks.updateNodeEndpoints.mockClear()
    })

    test('saving a custom config re-syncs every network, not just custom', () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
            Networks.custom,
            {
                algodUrl: 'http://10.0.0.5:4001',
                indexerUrl: 'http://10.0.0.5:8980',
                // No token set above, so it falls back to the (empty) baked
                // placeholder — see the `custom` entry in network-config.ts.
                algodToken: '',
                indexerToken: '',
            },
        )
        // Every other network still gets pushed, with its baked config — the
        // subscription callback takes no argument and re-pushes ALL networks
        // unconditionally rather than branching on which one changed (see
        // the "clearing" test below for why a keys/diff-based push would be
        // wrong here).
        for (const network of [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ]) {
            expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(network, {
                algodUrl: getNetworkConfig(network).algodUrl,
                indexerUrl: getNetworkConfig(network).indexerUrl,
                algodToken: getNetworkConfig(network).algodToken,
                indexerToken: getNetworkConfig(network).indexerToken,
            })
        }
    })

    test('clearing the custom config re-syncs it back to the empty baked placeholder, not the stale custom endpoints', () => {
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })
        // Isolate what clearCustomNetwork itself triggers from what
        // setCustomNetwork above already did.
        mocks.updateNodeEndpoints.mockClear()

        useCustomNetworkStore.getState().clearCustomNetwork()

        expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
            Networks.custom,
            {
                algodUrl: getNetworkConfig(Networks.custom).algodUrl,
                indexerUrl: getNetworkConfig(Networks.custom).indexerUrl,
                algodToken: getNetworkConfig(Networks.custom).algodToken,
                indexerToken: getNetworkConfig(Networks.custom).indexerToken,
            },
        )
    })
})

describe('initial push of a persisted custom config on module load', () => {
    // Placed last in this file deliberately: every test here calls
    // `vi.resetModules()` and re-imports `../algorandClient` dynamically, so
    // it must not run before the describe blocks above that rely on the
    // module instance captured by this file's own static top-level imports
    // (`vi.resetModules()` only affects what a LATER `import()` resolves to —
    // it does not retroactively change already-bound references — but there
    // is no reason to tempt that).
    test('a pre-seeded (persisted) custom config reaches updateNodeEndpoints on fresh module load, with no store write in this test', async () => {
        vi.resetModules()
        mocks.updateNodeEndpoints.mockClear()

        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        // Simulates a previous session's persisted custom config already on
        // disk BEFORE the module ever loads — no `setCustomNetwork` /
        // `clearCustomNetwork` / `resetState` call happens anywhere in this
        // test, only a raw write to the underlying storage
        // `custom-network-store.ts` reads from. zustand's `persist` hydration
        // is synchronous (MMKV's `getString` is sync in production; the
        // in-memory Map this package's vitest.setup.ts backs it with is sync
        // too), so the store created as part of the fresh import below has
        // already hydrated this value by the time `algorandClient.ts`
        // finishes evaluating.
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

        // Fresh import — pulls in a fresh `../store` (and therefore a fresh
        // `custom-network-store`) transitively, which hydrates from the
        // storage seeded above.
        await import('../algorandClient')

        // The push is deferred past module evaluation (see the comment in
        // algorandClient.ts), so give it a moment to fire rather than
        // asserting immediately.
        await vi.waitFor(() => {
            expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
                Networks.custom,
                {
                    algodUrl: 'http://10.0.0.9:4001',
                    indexerUrl: 'http://10.0.0.9:8980',
                    algodToken: '',
                    indexerToken: '',
                },
            )
        })

        // The three real networks (no custom config involved) get pushed
        // too — the loop is unconditional over every network, not just custom.
        expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
            Networks.mainnet,
            {
                algodUrl: getNetworkConfig(Networks.mainnet).algodUrl,
                indexerUrl: getNetworkConfig(Networks.mainnet).indexerUrl,
                algodToken: getNetworkConfig(Networks.mainnet).algodToken,
                indexerToken: getNetworkConfig(Networks.mainnet).indexerToken,
            },
        )
    })
})
