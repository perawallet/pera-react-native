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

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'
import { SIGNING_ACCESS_DOMAIN } from '../../constants'

const { mockGetProvider, keystoreState, createAlgo25Key, createQuantumKey } =
    vi.hoisted(() => ({
        mockGetProvider: vi.fn(),
        keystoreState: { keys: [] as Key[] },
        createAlgo25Key: vi.fn(),
        createQuantumKey: vi.fn(),
    }))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => mockGetProvider(),
    getKeystoreStore: () => ({ state: keystoreState }),
}))
vi.mock('../algo25Key', () => ({ createAlgo25Key }))
vi.mock('../quantumKey', () => ({ createQuantumKey }))

import { kmsCore } from '../kmsCore'

const seedKey = (id: string, expiresAt?: Date): Key =>
    ({
        id,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: true,
        metadata: {
            scheme: 'bip39',
            ...(expiresAt
                ? { pera: { expiresAt: expiresAt.toISOString() } }
                : {}),
        },
    }) as unknown as Key

const childKey = (id: string, parentKeyId: string): Key =>
    ({
        id,
        type: 'hd-derived-ed25519',
        algorithm: 'EdDSA',
        extractable: false,
        metadata: { parentKeyId },
    }) as unknown as Key

const NOW = new Date('2026-01-01T00:00:00Z')

describe('kmsCore', () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW })
        keystoreState.keys = [seedKey('seed-1'), childKey('c-1', 'seed-1')]
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    test('reads the provider keystore at call time, not at import', async () => {
        expect(mockGetProvider).not.toHaveBeenCalled()

        const sign = vi.fn(async () => new Uint8Array([9]))
        mockGetProvider.mockReturnValue({ key: { store: { sign } } })
        const payload = new Uint8Array([1])

        await expect(
            kmsCore.sign('c-1', payload, SIGNING_ACCESS_DOMAIN),
        ).resolves.toEqual(new Uint8Array([9]))
        expect(sign).toHaveBeenCalledWith('c-1', payload)
    })

    describe('getKey', () => {
        test('returns a held seed and a held child', () => {
            expect(kmsCore.getKey('seed-1')?.id).toBe('seed-1')
            expect(kmsCore.getKey('c-1')?.id).toBe('c-1')
        })

        test('is null for a key the keystore lacks', () => {
            expect(kmsCore.getKey('missing')).toBeNull()
        })

        test('is null for a seed past its expiry and for its children, without removing them', () => {
            const expired = new Date(NOW.getTime() - 1)
            keystoreState.keys = [
                seedKey('seed-1', expired),
                childKey('c-1', 'seed-1'),
            ]

            expect(kmsCore.getKey('seed-1')).toBeNull()
            expect(kmsCore.getKey('c-1')).toBeNull()
            expect(keystoreState.keys.map(k => k.id)).toEqual(['seed-1', 'c-1'])
        })

        test('returns a seed whose expiry is still ahead', () => {
            keystoreState.keys = [
                seedKey('seed-1', new Date(NOW.getTime() + 60_000)),
            ]

            expect(kmsCore.getKey('seed-1')?.id).toBe('seed-1')
        })
    })

    describe('discardMintedSeed', () => {
        test('removes the seed and its direct children, children first, leaving other keys', async () => {
            keystoreState.keys = [
                seedKey('seed-1'),
                childKey('c-1', 'seed-1'),
                childKey('c-2', 'seed-1'),
                seedKey('seed-2'),
                childKey('c-3', 'seed-2'),
            ]
            const remove = vi.fn(async (_id: string) => undefined)
            mockGetProvider.mockReturnValue({ key: { store: { remove } } })

            await kmsCore.discardMintedSeed('seed-1')

            expect(remove.mock.calls.map(([id]) => id)).toEqual([
                'c-1',
                'c-2',
                'seed-1',
            ])
        })
    })

    describe('key creation', () => {
        test('createAlgo25Key mints through the provider keystore', async () => {
            const store = { id: 'store' }
            mockGetProvider.mockReturnValue({ key: { store } })
            const result = { signKeyId: 'sign-1' }
            createAlgo25Key.mockResolvedValue(result)
            const params = { id: 'seed-9' }

            await expect(kmsCore.createAlgo25Key(params)).resolves.toBe(result)
            expect(createAlgo25Key).toHaveBeenCalledWith(store, params)
        })

        test('createQuantumKey mints through the provider keystore', async () => {
            const store = { id: 'store' }
            mockGetProvider.mockReturnValue({ key: { store } })
            const result = { signKeyId: 'sign-2' }
            createQuantumKey.mockResolvedValue(result)
            const params = {
                id: 'seed-10',
            } as unknown as Parameters<typeof kmsCore.createQuantumKey>[0]

            await expect(kmsCore.createQuantumKey(params)).resolves.toBe(result)
            expect(createQuantumKey).toHaveBeenCalledWith(store, params)
        })
    })
})
