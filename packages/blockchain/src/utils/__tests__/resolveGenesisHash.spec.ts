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
import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useNodeOverrideStore } from '../../store'
import {
    clearGenesisHashCache,
    resolveExpectedGenesisHash,
} from '../resolveGenesisHash'

// Spy-that-delegates: every test gets the REAL getNetworkConfig exactly as
// before, except the "empty baked hash" tests below, which queue a single
// mockReturnValueOnce override to simulate a config that should never exist
// in practice.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...original,
        getNetworkConfig: vi.fn(original.getNetworkConfig),
    }
})

const FNET_HASH = 'kUt08LxeVAAGHnh4JoAoAMM9ql/hBwSoiFtlnKNeOxA='
const BETANET_HASH = 'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0='
const LOCALNET_HASH = 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw='

// A fresh Response per call — a real fetch() never returns the same instance
// twice, and Response bodies can only be read once, so a shared instance
// breaks any test that resolves more than once (see the "Body is unusable"
// note in the git history of this file).
const okResponse = (hash: string) =>
    new Response(JSON.stringify({ 'genesis-hash': hash }), { status: 200 })

describe('resolveExpectedGenesisHash', () => {
    beforeEach(() => {
        clearGenesisHashCache()
        useNodeOverrideStore.getState().resetState()
        vi.restoreAllMocks()
        // Default every test to a REJECTED fetch. A regression that removes
        // the MainNet/TestNet short-circuit (see the test.each below) must be
        // caught by an assertion, never by falling through to a REAL outbound
        // request against production algod from a unit test. Tests that need
        // a specific response override this explicitly.
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('unexpected outbound fetch call in a unit test'),
        )
    })

    test.each([Networks.mainnet, Networks.testnet])(
        'returns the baked hash for %s without any network call',
        async network => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch')

            await expect(resolveExpectedGenesisHash(network)).resolves.toBe(
                getNetworkConfig(network).genesisHash,
            )
            expect(fetchSpy).not.toHaveBeenCalled()
        },
    )

    test.each([Networks.mainnet, Networks.testnet])(
        'throws for %s if the baked hash were ever empty, rather than treating it as valid',
        async network => {
            // Defensive-only: MainNet/TestNet always carry a non-empty baked
            // hash in real config. This proves the short-circuit itself
            // cannot return '' even if that ever stopped being true.
            const realConfig = getNetworkConfig(network)
            vi.mocked(getNetworkConfig).mockReturnValueOnce({
                ...realConfig,
                genesisHash: '',
            })

            await expect(resolveExpectedGenesisHash(network)).rejects.toThrow(
                /cannot verify network identity/i,
            )
        },
    )

    test('resolves localnet from the node and caches it', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => okResponse(LOCALNET_HASH))

        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).resolves.toBe(LOCALNET_HASH)
        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).resolves.toBe(LOCALNET_HASH)

        expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    test('re-resolves when the endpoint override changes', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => okResponse(LOCALNET_HASH))

        await resolveExpectedGenesisHash(Networks.localnet)
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001',
        })
        await resolveExpectedGenesisHash(Networks.localnet)

        expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    test('re-resolves after the cache TTL expires, so a LocalNet reset self-heals without an app restart', async () => {
        vi.useFakeTimers()
        try {
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockImplementation(async () => okResponse(LOCALNET_HASH))

            await resolveExpectedGenesisHash(Networks.localnet)
            // Same URL as before — only time has moved on. Comfortably past
            // any "tens of seconds" TTL without asserting the exact internal
            // constant.
            vi.advanceTimersByTime(5 * 60 * 1000)
            await resolveExpectedGenesisHash(Networks.localnet)

            expect(fetchSpy).toHaveBeenCalledTimes(2)
        } finally {
            vi.useRealTimers()
        }
    })

    test('normalizes a trailing slash in the algod URL before appending the API path', async () => {
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001/',
        })
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => okResponse(LOCALNET_HASH))

        await resolveExpectedGenesisHash(Networks.localnet)

        expect(fetchSpy).toHaveBeenCalledWith(
            'http://10.0.0.5:4001/v2/transactions/params',
            expect.anything(),
        )
    })

    test.each([
        [Networks.betanet, BETANET_HASH],
        [Networks.fnet, FNET_HASH],
    ])(
        'falls back to the baked hash when %s is unreachable',
        async (network, expectedHash) => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(
                new Error('offline'),
            )

            await expect(resolveExpectedGenesisHash(network)).resolves.toBe(
                expectedHash,
            )
        },
    )

    test('refuses to guess for localnet, which has no baked hash', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).rejects.toThrow(/cannot verify network identity/i)
    })
})
