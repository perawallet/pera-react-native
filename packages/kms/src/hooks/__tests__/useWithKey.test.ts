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
import { renderHook } from '@testing-library/react'
import { useWithKey } from '../useWithKey'
import { KeyAccessError, KeyNotFoundError } from '../../errors'
import { AccessControlPermission, KeyPair, KeyType } from '../../models'

// Mocks
const mockGetItem = vi.fn()

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: () => ({
        getItem: mockGetItem,
    }),
}))

const mockGetKey = vi.fn()

vi.mock('../../store', () => ({
    useKeyManagerStore: (selector: any) => {
        const state = {
            getKey: mockGetKey,
        }
        return selector(state)
    },
}))

describe('useWithKey', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should throw KeyNotFoundError if key does not exist', async () => {
        const { result } = renderHook(() => useWithKey())
        mockGetKey.mockReturnValue(undefined)

        await expect(
            result.current.executeWithKey(
                'missing-id',
                'pera.accounts',
                async () => {},
            ),
        ).rejects.toThrow(KeyNotFoundError)

        expect(mockGetKey).toHaveBeenCalledWith('missing-id')
        expect(mockGetItem).not.toHaveBeenCalled()
    })

    it('should throw KeyAccessError if private key is missing from storage', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(null) // Simulate missing private key

        await expect(
            result.current.executeWithKey(
                'test-id',
                'pera.accounts',
                async () => {},
            ),
        ).rejects.toThrow(KeyAccessError)

        expect(mockGetItem).toHaveBeenCalledWith('path')
    })

    it('should execute handler with private key', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKey = new Uint8Array([1, 2, 3])

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        const handler = vi.fn().mockResolvedValue('success')

        const output = await result.current.executeWithKey(
            'test-id',
            'pera.accounts',
            handler,
        )

        expect(output).toBe('success')
        expect(handler).toHaveBeenCalledWith(privateKey)
    })

    it('should not throw error if domain is a match and has permissions', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
            acl: [
                {
                    domains: ['pera.accounts'],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ],
        }
        const privateKey = new Uint8Array([1, 2, 3])

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        const handler = vi.fn().mockResolvedValue('success')

        const output = await result.current.executeWithKey(
            'test-id',
            'pera.accounts',
            handler,
        )

        expect(output).toBe('success')
        expect(handler).toHaveBeenCalledWith(privateKey)
    })

    it('should throw error if domain is a match but not has permissions', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
            acl: [
                {
                    domains: ['pera.accounts'],
                    permissions: [AccessControlPermission.ReadPublic],
                },
            ],
        }
        const privateKey = new Uint8Array([1, 2, 3])

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        const handler = vi.fn().mockResolvedValue('success')

        await expect(
            result.current.executeWithKey('test-id', 'pera.accounts', handler),
        ).rejects.toThrow(KeyAccessError)

        expect(handler).not.toHaveBeenCalled()
    })

    it('should throw error if domain is not a match', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
            acl: [
                {
                    domains: ['pera.passkeys'],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ],
        }
        const privateKey = new Uint8Array([1, 2, 3])

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        const handler = vi.fn().mockResolvedValue('success')

        await expect(
            result.current.executeWithKey('test-id', 'pera.accounts', handler),
        ).rejects.toThrow(KeyAccessError)

        expect(handler).not.toHaveBeenCalled()
    })

    it('should clear private key memory after execution', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKey = new Uint8Array([1, 2, 3])
        // Mock fill since it's a typed array method we want to spy on or verify effect
        const fillSpy = vi.spyOn(privateKey, 'fill')

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        await result.current.executeWithKey(
            'test-id',
            'pera.accounts',
            async () => {},
        )

        expect(fillSpy).toHaveBeenCalledWith(0)
    })

    it('should clear private key memory even if handler throws', async () => {
        const { result } = renderHook(() => useWithKey())
        const key: KeyPair = {
            id: 'test-id',
            privateDataStorageKey: 'path',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        const privateKey = new Uint8Array([1, 2, 3])
        const fillSpy = vi.spyOn(privateKey, 'fill')

        mockGetKey.mockReturnValue(key)
        mockGetItem.mockResolvedValue(privateKey)

        await expect(
            result.current.executeWithKey(
                'test-id',
                'pera.accounts',
                async () => {
                    throw new Error('handler error')
                },
            ),
        ).rejects.toThrow(KeyAccessError) // It wraps unknown errors

        expect(fillSpy).toHaveBeenCalledWith(0)
    })
})
