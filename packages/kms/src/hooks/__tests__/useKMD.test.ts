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
import { useKMD } from '../useKMD'
import { KeyPair, KeyType } from '../../models'

// Mocks
const mockSetItem = vi.fn()
const mockGetItem = vi.fn()
const mockRemoveItem = vi.fn()

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: () => ({
        setItem: mockSetItem,
        getItem: mockGetItem,
        removeItem: mockRemoveItem,
    }),
}))

const mockAddKey = vi.fn()
const mockRemoveKey = vi.fn()
const mockGetKey = vi.fn()
const mockKeys = new Map<string, KeyPair>()

vi.mock('../../store', () => ({
    useKeyManagerStore: (selector: any) => {
        // Simple selector mock
        const state = {
            keys: mockKeys,
            addKey: mockAddKey,
            removeKey: mockRemoveKey,
            getKey: mockGetKey,
        }
        return selector(state)
    },
}))

vi.mock('uuid', () => ({
    v7: vi.fn(() => 'mock-uuid'),
}))

describe('useKMD', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeys.clear()
    })

    it('should save a key', async () => {
        const { result } = renderHook(() => useKMD())
        const key: KeyPair = {
            privateDataStorageKey: '', // specific logic will overwrite this
            publicKey: 'public-key',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKeyData = new Uint8Array([1, 2, 3])

        await act(async () => {
            await result.current.saveKey(key, privateKeyData)
        })

        expect(key.id).toBe('mock-uuid')
        expect(key.privateDataStorageKey).toBe(
            'hdwallet-derived-key-public-key',
        )
        expect(key.createdAt).toBeInstanceOf(Date)

        expect(mockSetItem).toHaveBeenCalledWith(
            'hdwallet-derived-key-public-key',
            privateKeyData,
        )
        expect(mockAddKey).toHaveBeenCalledWith(key)
    })

    it('should save a key with no public key', async () => {
        const { result } = renderHook(() => useKMD())
        const key: KeyPair = {
            privateDataStorageKey: '', // specific logic will overwrite this
            publicKey: '',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKeyData = new Uint8Array([1, 2, 3])

        await act(async () => {
            await result.current.saveKey(key, privateKeyData)
        })

        expect(key.id).toBe('mock-uuid')
        expect(key.privateDataStorageKey).toBe('hdwallet-derived-key-mock-uuid')
        expect(key.createdAt).toBeInstanceOf(Date)

        expect(mockSetItem).toHaveBeenCalledWith(
            'hdwallet-derived-key-mock-uuid',
            privateKeyData,
        )
        expect(mockAddKey).toHaveBeenCalledWith(key)
    })

    it('should use provided id if available when saving key', async () => {
        const { result } = renderHook(() => useKMD())
        const key: KeyPair = {
            id: 'provided-id',
            privateDataStorageKey: '',
            publicKey: 'public-key',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKeyData = new Uint8Array([1, 2, 3])

        await act(async () => {
            await result.current.saveKey(key, privateKeyData)
        })

        expect(key.id).toBe('provided-id')
        expect(key.privateDataStorageKey).toBe(
            'hdwallet-derived-key-public-key',
        )

        expect(mockSetItem).toHaveBeenCalledWith(
            'hdwallet-derived-key-public-key',
            privateKeyData,
        )
        expect(mockAddKey).toHaveBeenCalledWith(key)
    })

    it('should delete a key', async () => {
        const { result } = renderHook(() => useKMD())
        const keyId = 'test-id'
        const key: KeyPair = {
            id: keyId,
            privateDataStorageKey: 'path/to/private',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }

        mockGetKey.mockReturnValue(key)

        await act(async () => {
            await result.current.deleteKey(keyId)
        })

        expect(mockGetKey).toHaveBeenCalledWith(keyId)
        expect(mockRemoveItem).toHaveBeenCalledWith('path/to/private')
        expect(mockRemoveKey).toHaveBeenCalledWith(keyId)
    })

    it('should do nothing when deleting a non-existent key', async () => {
        const { result } = renderHook(() => useKMD())
        mockGetKey.mockReturnValue(undefined)

        await act(async () => {
            await result.current.deleteKey('missing-id')
        })

        expect(mockRemoveItem).not.toHaveBeenCalled()
        expect(mockRemoveKey).not.toHaveBeenCalled()
    })

    it('should get private data', async () => {
        const { result } = renderHook(() => useKMD())
        const keyId = 'test-id'
        const key: KeyPair = {
            id: keyId,
            privateDataStorageKey: 'path/to/private',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateData = new Uint8Array([1, 2, 3])

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateData)

        let data
        await act(async () => {
            data = await result.current.getPrivateData(keyId)
        })

        expect(mockGetKey).toHaveBeenCalledWith(keyId)
        expect(mockGetItem).toHaveBeenCalledWith('path/to/private')
        expect(data).toBe(privateData)
    })

    it('should return null when getting private data for non-existent key', async () => {
        const { result } = renderHook(() => useKMD())
        mockGetKey.mockReturnValue(undefined)

        let data
        await act(async () => {
            data = await result.current.getPrivateData('missing')
        })

        expect(mockGetItem).not.toHaveBeenCalled()
        expect(data).toBeNull()
    })
})
