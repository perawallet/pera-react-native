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

// Partial mock: algorandClient.ts's module-level subscription (Step 7) would
// otherwise call the REAL updateNodeEndpoints on every setOverride/clearOverride
// /resetState below, building real ky clients as a side effect of unrelated
// tests. Only updateNodeEndpoints is swapped out — everything else
// (registerStore, logger, etc., which ../store's node-override-store.ts needs
// at import time) stays real via importOriginal, or the store import below
// would crash with "registerStore is not a function".
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    updateNodeEndpoints: mocks.updateNodeEndpoints,
}))

import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useNodeOverrideStore } from '../../store'
import { resolveChainEndpoints } from '../algorandClient'

describe('resolveChainEndpoints', () => {
    beforeEach(() => {
        useNodeOverrideStore.getState().resetState()
    })

    test('uses the baked chain config when there is no override', () => {
        expect(resolveChainEndpoints(Networks.fnet)).toEqual({
            algodUrl: getNetworkConfig(Networks.fnet).algodUrl,
            indexerUrl: getNetworkConfig(Networks.fnet).indexerUrl,
            algodToken: getNetworkConfig(Networks.fnet).algodToken,
            indexerToken: getNetworkConfig(Networks.fnet).indexerToken,
        })
    })

    test('an override replaces only the fields it sets', () => {
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001',
        })

        const resolved = resolveChainEndpoints(Networks.localnet)

        expect(resolved.algodUrl).toBe('http://10.0.0.5:4001')
        expect(resolved.indexerUrl).toBe(
            getNetworkConfig(Networks.localnet).indexerUrl,
        )
        expect(resolved.algodToken).toBe(
            getNetworkConfig(Networks.localnet).algodToken,
        )
    })
})

describe('node-override store subscription (real store, end-to-end)', () => {
    beforeEach(() => {
        useNodeOverrideStore.getState().resetState()
        mocks.updateNodeEndpoints.mockClear()
    })

    test('clearing an override re-syncs that network back to baked endpoints, not the stale override', () => {
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001',
        })
        // Isolate what clearOverride itself triggers from what setOverride
        // above already did.
        mocks.updateNodeEndpoints.mockClear()

        useNodeOverrideStore.getState().clearOverride(Networks.localnet)

        expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
            Networks.localnet,
            {
                algodUrl: getNetworkConfig(Networks.localnet).algodUrl,
                indexerUrl: getNetworkConfig(Networks.localnet).indexerUrl,
                algodToken: getNetworkConfig(Networks.localnet).algodToken,
                indexerToken: getNetworkConfig(Networks.localnet).indexerToken,
            },
        )
    })
})

describe('initial push of a persisted override on module load', () => {
    // Placed last in this file deliberately: every test here calls
    // `vi.resetModules()` and re-imports `../algorandClient` dynamically, so
    // it must not run before the describe blocks above that rely on the
    // module instance captured by this file's own static top-level imports
    // (`vi.resetModules()` only affects what a LATER `import()` resolves to —
    // it does not retroactively change already-bound references — but there
    // is no reason to tempt that).
    test('a pre-seeded (persisted) override reaches updateNodeEndpoints on fresh module load, with no store write in this test', async () => {
        vi.resetModules()
        mocks.updateNodeEndpoints.mockClear()

        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        // Simulates a previous session's persisted override already on disk
        // BEFORE the module ever loads — no `setOverride` / `clearOverride` /
        // `resetState` call happens anywhere in this test, only a raw write
        // to the underlying storage `node-override-store.ts` reads from.
        // zustand's `persist` hydration is synchronous (MMKV's `getString` is
        // sync in production; the in-memory Map this package's
        // vitest.setup.ts backs it with is sync too), so the store created
        // as part of the fresh import below has already hydrated this value
        // by the time `algorandClient.ts` finishes evaluating.
        getProvider().keyValueStorage.setItem(
            'node-override-store',
            JSON.stringify({
                state: {
                    overrides: {
                        [Networks.localnet]: {
                            algodUrl: 'http://10.0.0.9:4001',
                        },
                    },
                },
                version: 1,
            }),
        )

        // Fresh import — pulls in a fresh `../store` (and therefore a fresh
        // `node-override-store`) transitively, which hydrates from the
        // storage seeded above.
        await import('../algorandClient')

        // The push is deferred past module evaluation (see the comment in
        // algorandClient.ts), so give it a moment to fire rather than
        // asserting immediately.
        await vi.waitFor(() => {
            expect(mocks.updateNodeEndpoints).toHaveBeenCalledWith(
                Networks.localnet,
                {
                    algodUrl: 'http://10.0.0.9:4001',
                    indexerUrl: getNetworkConfig(Networks.localnet).indexerUrl,
                    algodToken: getNetworkConfig(Networks.localnet).algodToken,
                    indexerToken: getNetworkConfig(Networks.localnet)
                        .indexerToken,
                },
            )
        })

        // The other four networks (no override) get pushed too — the loop
        // is unconditional over every network, not just the overridden one.
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
