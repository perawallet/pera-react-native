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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResolveSeedEntropyForBackup } from '../useResolveSeedEntropyForBackup'

const {
    keystoreKeys,
    getDerivedPublicKeyMock,
    secretBytesById,
    withSecretMock,
} = vi.hoisted(() => {
    const secretBytesById = new Map<string, Uint8Array>()
    return {
        keystoreKeys: vi.fn().mockReturnValue([]),
        getDerivedPublicKeyMock: vi.fn(),
        secretBytesById,
        // Mirrors `withSecret`'s real contract: hands the handler a live
        // buffer, then zeroes THAT SAME buffer once the handler returns —
        // so a resolver that returns the reference instead of a copy gets
        // zeros back.
        withSecretMock: vi.fn(
            async (id: string, handler: (bytes: Uint8Array) => unknown) => {
                const bytes = secretBytesById.get(id)
                if (!bytes) return null
                try {
                    return await handler(bytes)
                } finally {
                    bytes.fill(0)
                }
            },
        ),
    }
})

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Khovratovich: 32, Peikert: 9 },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: (pub: Uint8Array) => `ADDR-${pub[0]}`,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    SeedScheme: { Bip39: 'bip39', Algo25: 'algo25', Quantum: 'quantum' },
    seedSchemeOf: (key: { type: string }) =>
        key.type === 'hd-root-key' ? 'bip39' : null,
    entropyChildIdOf: (
        seedKeyId: string,
        keys: { id: string; type: string; metadata?: unknown }[],
    ) =>
        keys.find(k => {
            const meta = (k.metadata ?? {}) as {
                parentKeyId?: unknown
                entropyKey?: unknown
            }
            return (
                k.type === 'secret-key' &&
                meta.parentKeyId === seedKeyId &&
                meta.entropyKey === true
            )
        })?.id,
    withSecret: withSecretMock,
    useKMS: () => ({ getDerivedPublicKey: getDerivedPublicKeyMock }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: keystoreKeys() } }),
}))

describe('useResolveSeedEntropyForBackup', () => {
    beforeEach(() => {
        secretBytesById.clear()
        getDerivedPublicKeyMock.mockReset()
        withSecretMock.mockClear()
    })

    it('returns the entropy of the seed whose first-derived address matches', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
            {
                id: 'entropy-1',
                type: 'secret-key',
                metadata: { parentKeyId: 'seed-1', entropyKey: true },
            },
        ])
        secretBytesById.set('entropy-1', new Uint8Array(32).fill(7))
        getDerivedPublicKeyMock.mockResolvedValue(new Uint8Array([9]))

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const entropy = await result.current('ADDR-9')

        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 0, 0, 9)
        // Survives the `withSecret` handler returning: not the same zeroed
        // buffer, and every byte is still 7.
        expect(entropy).not.toBeNull()
        expect(entropy).toEqual(new Uint8Array(32).fill(7))
        expect(Array.from(entropy as Uint8Array).every(b => b === 0)).toBe(
            false,
        )
    })

    it('returns null when no on-device seed reproduces the address', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
        ])
        getDerivedPublicKeyMock.mockResolvedValue(new Uint8Array([1]))

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const entropy = await result.current('ADDR-NOT-FOUND')

        expect(entropy).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
    })

    it('returns null when the matching seed has no entropy child', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
        ])
        getDerivedPublicKeyMock.mockResolvedValue(new Uint8Array([9]))

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const entropy = await result.current('ADDR-9')

        expect(entropy).toBeNull()
    })

    it('skips non-bip39 seeds when searching for the address', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'algo25-1', type: 'seed', metadata: {} },
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
            {
                id: 'entropy-1',
                type: 'secret-key',
                metadata: { parentKeyId: 'seed-1', entropyKey: true },
            },
        ])
        secretBytesById.set('entropy-1', new Uint8Array(32).fill(3))
        getDerivedPublicKeyMock.mockResolvedValue(new Uint8Array([9]))

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const entropy = await result.current('ADDR-9')

        expect(entropy).toEqual(new Uint8Array(32).fill(3))
        expect(getDerivedPublicKeyMock).toHaveBeenCalledTimes(1)
    })
})
