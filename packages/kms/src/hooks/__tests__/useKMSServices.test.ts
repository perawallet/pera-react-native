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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKMSService, checkAccess } from '../useKMSServices'
import { AccessControlPermission, KeyPair, KeyType } from '../../models'
import { KeyAccessError } from '../../errors'

const mockKeyStoreRemove = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreSign = vi.fn()

vi.mock('@perawallet/wallet-extension-platform', () => ({
    useKeyStoreService: () => ({
        remove: mockKeyStoreRemove,
        import: mockKeyStoreImport,
        sign: mockKeyStoreSign,
    }),
}))

const mockAddKey = vi.fn()
const mockRemoveKey = vi.fn()
const mockGetKey = vi.fn()

vi.mock('../../store', () => ({
    useKeyManagerStore: (selector: any) => {
        const state = {
            addKey: mockAddKey,
            removeKey: mockRemoveKey,
            getKey: mockGetKey,
        }
        return selector(state)
    },
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        generateOrderedUniqueId: () => 'mock-uuid-v7',
    }
})

describe('useKMSService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('saveKey', () => {
        test('adds key to store and returns it', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'TESTADDR',
                type: KeyType.Algo25Key,
                keystoreKeyId: 'ks-key-1',
                createdAt: new Date(),
            }

            const { result } = renderHook(() => useKMSService())

            let savedKey: KeyPair | undefined
            await act(async () => {
                savedKey = await result.current.saveKey(key)
            })

            expect(mockAddKey).toHaveBeenCalledWith(key)
            expect(savedKey).toBe(key)
        })

    })

    describe('deleteKey', () => {
        test('removes key from keystore extension and store', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'ADDR',
                type: KeyType.Algo25Key,
                keystoreKeyId: 'ks-key-1',
            }
            mockGetKey.mockReturnValue(key)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('key-1')
            })

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('ks-key-1')
            expect(mockRemoveKey).toHaveBeenCalledWith('key-1')
        })

        test('does nothing when key is not found', async () => {
            mockGetKey.mockReturnValue(null)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('nonexistent')
            })

            expect(mockKeyStoreRemove).not.toHaveBeenCalled()
            expect(mockRemoveKey).not.toHaveBeenCalled()
        })

        test('skips keystore removal when no keystoreKeyId', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'ADDR',
                type: KeyType.Algo25Key,
            }
            mockGetKey.mockReturnValue(key)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('key-1')
            })

            expect(mockKeyStoreRemove).not.toHaveBeenCalled()
            expect(mockRemoveKey).toHaveBeenCalledWith('key-1')
        })
    })

    describe('checkAccess', () => {
        const makeKey = (overrides?: Partial<KeyPair>): KeyPair => ({
            id: 'key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            keystoreKeyId: 'ks-key-1',
            ...overrides,
        })

        test('allows access when ACL grants ReadPrivate for domain', () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['test-domain'],
                        permissions: [AccessControlPermission.ReadPrivate],
                    },
                ],
            })

            expect(() => checkAccess(key, 'test-domain')).not.toThrow()
        })

        test('throws KeyAccessError when ACL denies access for domain', () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['other-domain'],
                        permissions: [AccessControlPermission.ReadPrivate],
                    },
                ],
            })

            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('throws KeyAccessError when ACL lacks ReadPrivate permission', () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['test-domain'],
                        permissions: [AccessControlPermission.ReadPublic],
                    },
                ],
            })

            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('allows access when key has no ACL', () => {
            const key = makeKey({ acl: undefined })

            expect(() => checkAccess(key, 'test-domain')).not.toThrow()
        })

        test('allows access when key has empty ACL', () => {
            const key = makeKey({ acl: [] })

            expect(() => checkAccess(key, 'test-domain')).not.toThrow()
        })

        test('is returned from useKMSService hook', () => {
            const { result } = renderHook(() => useKMSService())

            expect(result.current.checkAccess).toBe(checkAccess)
        })
    })

    describe('keyStore', () => {
        test('exposes the keystore API', () => {
            const { result } = renderHook(() => useKMSService())

            expect(result.current.keyStore).toBeDefined()
            expect(result.current.keyStore.remove).toBe(mockKeyStoreRemove)
            expect(result.current.keyStore.import).toBe(mockKeyStoreImport)
            expect(result.current.keyStore.sign).toBe(mockKeyStoreSign)
        })
    })
})
