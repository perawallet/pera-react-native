/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { renderHook, act } from '@testing-library/react'
import type { Key } from '@algorandfoundation/keystore'
import type { Optional } from '@perawallet/wallet-core-shared'
import { InvalidKeyError, KeyNotFoundError } from '../../errors'
import { SeedScheme } from '../../constants'
import { mnemonicIndexToWord } from '../../crypto/mnemonic-indices'

// Source-of-truth keystore Key list mocked at the module that bridges to
// the platform keystore. useKMS reads from this via useKeystoreKeys() AND
// directly via getKeystoreStore().state.keys for live (non-React) lookups.
let mockKeystoreKeys: Key[] = []

vi.mock('../useKeystoreState', () => ({
    useKeystoreKeys: () => mockKeystoreKeys,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        get state() {
            return { keys: mockKeystoreKeys, status: 'idle' as const }
        },
    }),
}))

const mockDeleteKey = vi.fn()
const mockKeyStoreRemove = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreExport = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        deleteKey: (...args: any[]) => mockDeleteKey(...args),
        keyStore: {
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
            sign: (...args: any[]) => mockKeyStoreSign(...args),
            export: (...args: any[]) => mockKeyStoreExport(...args),
        },
        withExportedKey: async (
            keyId: string,
            handler: (keyData: any) => any,
        ) => {
            const keyData = await mockKeyStoreExport(keyId)
            return handler(keyData)
        },
        checkAccess: vi.fn(),
    }),
}))

const mockCreateHDWalletKey = vi.fn()
vi.mock('../useHDWallet', () => ({
    useHDWallet: () => ({
        createHDWalletKey: (...args: any[]) => mockCreateHDWalletKey(...args),
        generateDerivedKey: vi.fn(),
        getDerivedPublicKey: vi.fn(),
        persistHDMasterKey: vi.fn(),
    }),
}))

const mockCreateAlgo25Key = vi.fn()
vi.mock('../useAlgo25', () => ({
    useAlgo25: () => ({
        createAlgo25Key: (...args: any[]) => mockCreateAlgo25Key(...args),
    }),
}))

const mockEntropyToMnemonic = vi.fn()
vi.mock('../../crypto/hdwallet-utils', () => ({
    entropyToMnemonic: (...args: any[]) => mockEntropyToMnemonic(...args),
}))

const mockMnemonicFromSeed = vi.fn()
vi.mock('@algorandfoundation/algokit-utils/algo25', () => ({
    mnemonicFromSeed: (...args: any[]) => mockMnemonicFromSeed(...args),
}))

import { useKMS } from '../useKMS'

const seedBip39Root = (id: string, entropy = '00ff'): Key => {
    const key: Key = {
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: SeedScheme.Bip39, entropy, pera: {} },
    }
    mockKeystoreKeys.push(key)
    return key
}

const seedAlgo25Root = (id: string): Key => {
    const key: Key = {
        id,
        type: 'seed',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: SeedScheme.Algo25, pera: {} },
    }
    mockKeystoreKeys.push(key)
    return key
}

const childOf = (childId: string, parentId: string, type = 'ed25519'): Key => {
    const key: Key = {
        id: childId,
        type,
        algorithm: 'EdDSA',
        extractable: false,
        metadata: { parentKeyId: parentId },
    }
    mockKeystoreKeys.push(key)
    return key
}

describe('useKMS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeystoreKeys = []
    })

    it('exposes deleteKey from useKMSService', async () => {
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.deleteKey('test-id')
        })
        expect(mockDeleteKey).toHaveBeenCalledWith('test-id')
    })

    it('exposes createHDWalletKey from useHDWallet', async () => {
        const mockResult = { seedKey: { id: 'wallet-1', type: 'seed' } }
        mockCreateHDWalletKey.mockResolvedValue(mockResult)
        const { result } = renderHook(() => useKMS())
        let keyResult: any
        await act(async () => {
            keyResult = await result.current.createHDWalletKey({
                id: 'wallet-1',
            })
        })
        expect(mockCreateHDWalletKey).toHaveBeenCalledWith({ id: 'wallet-1' })
        expect(keyResult).toEqual(mockResult)
    })

    it('getKeyOrThrow throws when the key is not in the reactive store', () => {
        const { result } = renderHook(() => useKMS())
        expect(() => result.current.getKeyOrThrow('missing-id')).toThrow(
            KeyNotFoundError,
        )
    })

    it('getKeyOrThrow returns the keystore Key when present', () => {
        seedBip39Root('hd-1')
        const { result } = renderHook(() => useKMS())
        const key = result.current.getKeyOrThrow('hd-1')
        expect(key.id).toBe('hd-1')
        expect(key.type).toBe('seed')
    })

    it('keys map contains only seed entries with a recognised scheme', () => {
        seedBip39Root('hd-1')
        seedAlgo25Root('algo-1')
        childOf('child-1', 'hd-1', 'hd-derived-ed25519')
        mockKeystoreKeys.push({
            id: 'pin',
            type: 'secret-key',
            algorithm: 'raw',
            extractable: true,
        })

        const { result } = renderHook(() => useKMS())

        expect(result.current.keys.size).toBe(2)
        expect(result.current.keys.get('hd-1')?.type).toBe('seed')
        expect(result.current.keys.get('algo-1')?.type).toBe('seed')
        expect(result.current.keys.get('child-1')).toBeUndefined()
        expect(result.current.keys.get('pin')).toBeUndefined()
    })

    it('seedIdOf walks metadata.parentKeyId to the seed', () => {
        seedBip39Root('hd-1')
        childOf('hd-1-acc0-idx0-dt9', 'hd-1', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())

        expect(result.current.seedIdOf('hd-1-acc0-idx0-dt9')).toBe('hd-1')
        // Seeds themselves don't have parents.
        expect(result.current.seedIdOf('hd-1')).toBeUndefined()
        expect(result.current.seedIdOf('unknown')).toBeUndefined()
    })

    it('signTransactionsWithKey calls keyStore.sign(childId) once per item', async () => {
        seedBip39Root('hd-1')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        mockKeyStoreSign
            .mockResolvedValueOnce(new Uint8Array(64).fill(1))
            .mockResolvedValueOnce(new Uint8Array(64).fill(2))

        const { result } = renderHook(() => useKMS())
        let signed: Optional<Uint8Array[]>
        await act(async () => {
            signed = await result.current.signTransactionsWithKey(
                child.id,
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
            )
        })
        expect(signed).toHaveLength(2)
        expect(mockKeyStoreSign).toHaveBeenNthCalledWith(
            1,
            child.id,
            new Uint8Array([1]),
        )
        expect(mockKeyStoreSign).toHaveBeenNthCalledWith(
            2,
            child.id,
            new Uint8Array([2]),
        )
    })

    it('signTransactionsWithKey accepts a seed id directly (legacy callers)', async () => {
        seedAlgo25Root('algo-1')
        mockKeyStoreSign.mockResolvedValueOnce(new Uint8Array(64))
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.signTransactionsWithKey('algo-1', 'd', [
                new Uint8Array([1]),
            ])
        })
        expect(mockKeyStoreSign).toHaveBeenCalledWith(
            'algo-1',
            new Uint8Array([1]),
        )
    })

    it('signDataWithKey calls keyStore.sign(childId) once per item', async () => {
        seedBip39Root('hd-1')
        childOf('child-1', 'hd-1', 'hd-derived-ed25519')
        mockKeyStoreSign.mockResolvedValue(new Uint8Array(64).fill(3))
        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.signDataWithKey('child-1', 'd', [
                new Uint8Array([1]),
                new Uint8Array([2]),
            ])
        })
        expect(mockKeyStoreSign).toHaveBeenCalledTimes(2)
    })

    it('signTransactionsWithKey throws InvalidKeyError when the resolved entry is neither a seed nor a known child', async () => {
        // No seed and no child registered — but the id exists as some
        // other kind of top-level entry. seedIdOf returns undefined and
        // direct lookup finds a non-seed entry, so we error out.
        mockKeystoreKeys.push({
            id: 'rsa-1',
            type: 'rsa',
            algorithm: 'RS256',
            extractable: true,
        })
        const { result } = renderHook(() => useKMS())
        await expect(
            act(async () => {
                await result.current.signTransactionsWithKey('rsa-1', 'd', [
                    new Uint8Array([1]),
                ])
            }),
        ).rejects.toThrow(InvalidKeyError)
    })

    it('executeWithMnemonic for a bip39 seed exports + decodes via entropyToMnemonic', async () => {
        seedBip39Root('hd-1', 'abcdef01')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        mockEntropyToMnemonic.mockReturnValue('ability able about')
        mockKeyStoreExport.mockResolvedValueOnce({
            metadata: { scheme: SeedScheme.Bip39, entropy: 'abcdef01' },
        })

        const { result } = renderHook(() => useKMS())
        let received: Optional<string[]>
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => Array.from(indices, mnemonicIndexToWord),
            )
        })
        expect(mockKeyStoreExport).toHaveBeenCalledWith('hd-1')
        expect(received).toEqual(['ability', 'able', 'about'])
    })

    it('executeWithMnemonic for an algo25 seed exports + decodes via mnemonicFromSeed', async () => {
        seedAlgo25Root('algo-1')
        const child = childOf('algo-1-ed25519', 'algo-1', 'ed25519')
        mockMnemonicFromSeed.mockReturnValue('above absent absorb')
        mockKeyStoreExport.mockResolvedValueOnce({
            privateKey: new Uint8Array(32).fill(7),
        })

        const { result } = renderHook(() => useKMS())
        let received: Optional<string[]>
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => Array.from(indices, mnemonicIndexToWord),
            )
        })
        expect(mockKeyStoreExport).toHaveBeenCalledWith('algo-1')
        expect(received).toEqual(['above', 'absent', 'absorb'])
    })

    it('executeWithMnemonic zeroes the index buffer after the handler returns', async () => {
        seedBip39Root('hd-1', 'abcdef01')
        const child = childOf('hd-1-c0', 'hd-1', 'hd-derived-ed25519')
        mockEntropyToMnemonic.mockReturnValue('ability able about')
        mockKeyStoreExport.mockResolvedValueOnce({
            metadata: { scheme: SeedScheme.Bip39, entropy: 'abcdef01' },
        })

        const { result } = renderHook(() => useKMS())
        let captured: Optional<Uint16Array>
        await act(async () => {
            await result.current.executeWithMnemonic(
                child.id,
                'backup',
                indices => {
                    captured = indices
                    // [ability, able, about] → non-zero indices, so a wipe is
                    // unambiguous.
                    expect(Array.from(indices)).toEqual([1, 2, 3])
                    return Array.from(indices, mnemonicIndexToWord)
                },
            )
        })
        // Scrubbed once the session ends, not left for GC.
        expect(captured && Array.from(captured)).toEqual([0, 0, 0])
    })

    it('getKey returns null and triggers async keystore.remove when expiresAt is in the past', () => {
        const past = new Date(Date.now() - 60_000).toISOString()
        mockKeystoreKeys.push({
            id: 'expired-key',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: {
                scheme: SeedScheme.Bip39,
                pera: { expiresAt: past },
            },
        })
        const { result } = renderHook(() => useKMS())
        expect(result.current.getKey('expired-key')).toBeNull()
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('expired-key')
    })

    it('removeKeyAndChildren removes the seed and any keys whose parentKeyId points to it', async () => {
        seedBip39Root('hd-1')
        childOf('child-a', 'hd-1', 'hd-derived-ed25519')
        childOf('child-b', 'hd-1', 'hd-derived-ed25519')
        seedBip39Root('hd-2')
        childOf('child-c', 'hd-2', 'hd-derived-ed25519')

        const { result } = renderHook(() => useKMS())
        await act(async () => {
            await result.current.removeKeyAndChildren('hd-1')
        })

        // child-a and child-b removed first, then the seed
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('child-a')
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('child-b')
        expect(mockKeyStoreRemove).toHaveBeenCalledWith('hd-1')
        // child-c (under hd-2) is left alone
        expect(mockKeyStoreRemove).not.toHaveBeenCalledWith('child-c')
        expect(mockKeyStoreRemove).not.toHaveBeenCalledWith('hd-2')
    })
})
