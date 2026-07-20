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

import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { GenesisProbeClient } from '../nodeCapability'

// Realistic base64 genesis hashes used across the suite.
const MAINNET_GENESIS_HASH_B64 = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
const TESTNET_GENESIS_HASH_B64 = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
const LOCALNET_GENESIS_HASH_B64 = 'C3sYDHhVSNW+A8b1KLLXaXqRfPLLmkYWYxc9/qDsDcs='

const PRODUCTION_GENESIS_HASHES_B64 = [
    MAINNET_GENESIS_HASH_B64,
    TESTNET_GENESIS_HASH_B64,
] as const

type ProbeMocks = {
    client: GenesisProbeClient
    versionsCheck: ReturnType<typeof vi.fn>
    doMock: ReturnType<typeof vi.fn>
}

const makeAlgod = (
    genesisHashB64: string | Uint8Array | null | undefined,
    options: { reject?: boolean } = {},
): ProbeMocks => {
    const doMock = vi.fn(() =>
        options.reject
            ? Promise.reject(new Error('probe failed'))
            : Promise.resolve({ genesisHashB64 }),
    )
    const versionsCheck = vi.fn(() => ({ do: doMock }))
    return { client: { versionsCheck }, versionsCheck, doMock }
}

// The module keeps caches at module scope; reset + dynamic-import so no
// memoized entry leaks between test cases.
const importModule = async () => {
    vi.resetModules()
    return import('../nodeCapability')
}

describe('supportsQuantumBroadcast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns true when the node genesis hash is not in the production list', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod(LOCALNET_GENESIS_HASH_B64)

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(true)
    })

    test('returns true when the node returns the genesis hash as raw bytes', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const genesisBytes = new Uint8Array(
            Buffer.from(LOCALNET_GENESIS_HASH_B64, 'base64'),
        )
        const { client } = makeAlgod(genesisBytes)

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(true)
    })

    test('returns false for a mainnet-style production genesis hash', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod(MAINNET_GENESIS_HASH_B64)

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(false)
    })

    test('returns false for a testnet-style production genesis hash', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod(TESTNET_GENESIS_HASH_B64)

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(false)
    })

    test('memoizes the probe: two calls trigger only one network probe', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client, versionsCheck, doMock } = makeAlgod(
            LOCALNET_GENESIS_HASH_B64,
        )

        // Act
        const first = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )
        const second = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(first).toBe(true)
        expect(second).toBe(true)
        expect(versionsCheck).toHaveBeenCalledTimes(1)
        expect(doMock).toHaveBeenCalledTimes(1)
    })

    test('returns false when the probe rejects', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod(LOCALNET_GENESIS_HASH_B64, {
            reject: true,
        })

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(false)
    })

    test('returns false when the genesis hash is missing', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod(undefined)

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(false)
    })

    test('returns false when the genesis hash is an empty string', async () => {
        // Arrange
        const { supportsQuantumBroadcast } = await importModule()
        const { client } = makeAlgod('')

        // Act
        const result = await supportsQuantumBroadcast(
            client,
            PRODUCTION_GENESIS_HASHES_B64,
        )

        // Assert
        expect(result).toBe(false)
    })
})
