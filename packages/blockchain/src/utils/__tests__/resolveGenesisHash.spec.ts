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

const FNET_HASH = 'kUt08LxeVAAGHnh4JoAoAMM9ql/hBwSoiFtlnKNeOxA='
const LOCALNET_HASH = 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw='

describe('resolveExpectedGenesisHash', () => {
    beforeEach(() => {
        clearGenesisHashCache()
        useNodeOverrideStore.getState().resetState()
        vi.restoreAllMocks()
    })

    test('returns the baked hash for mainnet without any network call', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')

        await expect(
            resolveExpectedGenesisHash(Networks.mainnet),
        ).resolves.toBe(getNetworkConfig(Networks.mainnet).genesisHash)
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('resolves localnet from the node and caches it', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ 'genesis-hash': LOCALNET_HASH }),
                    { status: 200 },
                ),
            )

        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).resolves.toBe(LOCALNET_HASH)
        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).resolves.toBe(LOCALNET_HASH)

        expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    test('re-resolves when the endpoint override changes', async () => {
        // A real fetch() returns a fresh Response per call; mockResolvedValue
        // would hand back the SAME instance both times, and Response bodies
        // can only be read once — the second .json() would throw "Body is
        // unusable". mockImplementation constructs a new Response per call so
        // both resolutions succeed, matching real fetch semantics.
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(
                async () =>
                    new Response(
                        JSON.stringify({ 'genesis-hash': LOCALNET_HASH }),
                        { status: 200 },
                    ),
            )

        await resolveExpectedGenesisHash(Networks.localnet)
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001',
        })
        await resolveExpectedGenesisHash(Networks.localnet)

        expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    test('falls back to the baked hash when fnet is unreachable', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

        await expect(resolveExpectedGenesisHash(Networks.fnet)).resolves.toBe(
            FNET_HASH,
        )
    })

    test('refuses to guess for localnet, which has no baked hash', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

        await expect(
            resolveExpectedGenesisHash(Networks.localnet),
        ).rejects.toThrow(/cannot verify network identity/i)
    })
})
