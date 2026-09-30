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
    deriveHdAccountMock,
    secretBytesById,
    withSecretMock,
    canAccessMock,
} = vi.hoisted(() => {
    const secretBytesById = new Map<string, Uint8Array>()
    return {
        canAccessMock: vi.fn((_key: unknown, _domain: string) => true),
        keystoreKeys: vi.fn().mockReturnValue([]),
        deriveHdAccountMock: vi.fn(),
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

vi.mock('@perawallet/wallet-core-accounts', () => ({
    deriveHdAccount: deriveHdAccountMock,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    BACKUP_ACCESS_DOMAIN: 'backup-flow',
    canAccess: (key: unknown, domain: string) => canAccessMock(key, domain),
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
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: keystoreKeys() } }),
}))

describe('useResolveSeedEntropyForBackup', () => {
    beforeEach(() => {
        secretBytesById.clear()
        deriveHdAccountMock.mockReset()
        withSecretMock.mockClear()
        canAccessMock.mockClear().mockReturnValue(true)
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
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-9' })

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const resolved = await result.current('ADDR-9')

        expect(deriveHdAccountMock).toHaveBeenCalledWith('mainnet', 'seed-1', {
            account: 0,
            keyIndex: 0,
        })
        // Survives the `withSecret` handler returning: not the same zeroed
        // buffer, and every byte is still 7.
        expect(resolved).not.toBeNull()
        expect(resolved?.entropy).toEqual(new Uint8Array(32).fill(7))
        expect(
            Array.from(resolved?.entropy as Uint8Array).every(b => b === 0),
        ).toBe(false)
    })

    it('returns null when no on-device seed reproduces the address', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
        ])
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-1' })

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const resolved = await result.current('ADDR-NOT-FOUND')

        expect(resolved).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
    })

    it('returns null when the matching seed has no entropy child', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
        ])
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-9' })

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const resolved = await result.current('ADDR-9')

        expect(resolved).toBeNull()
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
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-9' })

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())
        const resolved = await result.current('ADDR-9')

        expect(resolved?.entropy).toEqual(new Uint8Array(32).fill(3))
        expect(deriveHdAccountMock).toHaveBeenCalledTimes(1)
    })

    // The written credential's `parentKeyId` is built from this, and it has to
    // be the id this device minted, not the one the collecting device had.
    it('reports the local key id of the seed it matched', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'local-seed-id', type: 'hd-root-key', metadata: {} },
            {
                id: 'entropy-1',
                type: 'secret-key',
                metadata: { parentKeyId: 'local-seed-id', entropyKey: true },
            },
        ])
        secretBytesById.set('entropy-1', new Uint8Array(32).fill(5))
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-9' })

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())

        expect((await result.current('ADDR-9'))?.seedKeyId).toBe(
            'local-seed-id',
        )
    })

    it('returns null without reading the entropy of a seed whose ACL denies the backup domain', async () => {
        keystoreKeys.mockReturnValue([
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
            {
                id: 'entropy-1',
                type: 'secret-key',
                metadata: { parentKeyId: 'seed-1', entropyKey: true },
            },
        ])
        secretBytesById.set('entropy-1', new Uint8Array(32).fill(7))
        deriveHdAccountMock.mockResolvedValue({ address: 'ADDR-9' })
        canAccessMock.mockReturnValue(false)

        const { result } = renderHook(() => useResolveSeedEntropyForBackup())

        expect(await result.current('ADDR-9')).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
    })
})
