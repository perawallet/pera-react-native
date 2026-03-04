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
import { useKMSService } from '../useKMSServices'
import {
    AccessControlPermission,
    KeyPair,
    KeyType,
    StoredKeyMaterial,
} from '../../models'
import { KeyAccessError } from '../../errors'

const mockSetItem = vi.fn()
const mockGetItem = vi.fn()
const mockRemoveItem = vi.fn()

vi.mock('@perawallet/wallet-extension-platform', () => ({
    useSecureStorageService: () => ({
        setItem: mockSetItem,
        getItem: mockGetItem,
        removeItem: mockRemoveItem,
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
        test('stores key data in secure storage and adds to store', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'TESTADDR',
                type: KeyType.Algo25Key,
                privateDataStorageKey: '',
                createdAt: new Date(),
            }
            const keyData: StoredKeyMaterial = {
                seed: btoa('secret'),
                seedFormat: 'base64',
            }

            const { result } = renderHook(() => useKMSService())

            let savedKey: KeyPair | undefined
            await act(async () => {
                savedKey = await result.current.saveKey(key, keyData)
            })

            expect(mockSetItem).toHaveBeenCalledTimes(1)
            expect(mockSetItem.mock.calls[0][0]).toBe(
                `${KeyType.Algo25Key}-TESTADDR`,
            )
            const storedValue = mockSetItem.mock.calls[0][1]
            expect(storedValue.constructor.name).toBe('Uint8Array')
            expect(mockAddKey).toHaveBeenCalledWith(savedKey)
            expect(savedKey!.id).toBe('key-1')
            expect(savedKey!.privateDataStorageKey).toBe(
                `${KeyType.Algo25Key}-TESTADDR`,
            )
        })

        test('generates uuid for id when not provided', async () => {
            const key: KeyPair = {
                publicKey: '',
                type: KeyType.HDWalletRootKey,
                privateDataStorageKey: '',
            }
            const keyData: StoredKeyMaterial = {
                seed: btoa('secret'),
                seedFormat: 'base64',
            }

            const { result } = renderHook(() => useKMSService())

            let savedKey: KeyPair | undefined
            await act(async () => {
                savedKey = await result.current.saveKey(key, keyData)
            })

            expect(savedKey!.id).toBe('mock-uuid-v7')
        })

        test('uses storageKey with id when publicKey is empty', async () => {
            const key: KeyPair = {
                id: 'hd-key-1',
                publicKey: '',
                type: KeyType.HDWalletRootKey,
                privateDataStorageKey: '',
            }
            const keyData: StoredKeyMaterial = {
                seed: btoa('secret'),
                seedFormat: 'base64',
            }

            const { result } = renderHook(() => useKMSService())

            let savedKey: KeyPair | undefined
            await act(async () => {
                savedKey = await result.current.saveKey(key, keyData)
            })

            expect(savedKey!.privateDataStorageKey).toBe(
                `${KeyType.HDWalletRootKey}-hd-key-1`,
            )
        })

        test('stores serialized key data as encoded bytes', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'ADDR',
                type: KeyType.Algo25Key,
                privateDataStorageKey: '',
            }
            const keyData: StoredKeyMaterial = {
                seed: 'dGVzdA==',
                seedFormat: 'base64',
            }

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.saveKey(key, keyData)
            })

            const storedBytes = mockSetItem.mock.calls[0][1] as Uint8Array
            const decoded = JSON.parse(new TextDecoder().decode(storedBytes))
            expect(decoded).toEqual(keyData)
        })
    })

    describe('deleteKey', () => {
        test('removes key from secure storage and store', async () => {
            const key: KeyPair = {
                id: 'key-1',
                publicKey: 'ADDR',
                type: KeyType.Algo25Key,
                privateDataStorageKey: 'algo25-key-ADDR',
            }
            mockGetKey.mockReturnValue(key)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('key-1')
            })

            expect(mockRemoveItem).toHaveBeenCalledWith('algo25-key-ADDR')
            expect(mockRemoveKey).toHaveBeenCalledWith('key-1')
        })

        test('does nothing when key is not found', async () => {
            mockGetKey.mockReturnValue(null)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('nonexistent')
            })

            expect(mockRemoveItem).not.toHaveBeenCalled()
            expect(mockRemoveKey).not.toHaveBeenCalled()
        })

        test('skips secure storage removal when no privateDataStorageKey', async () => {
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

            expect(mockRemoveItem).not.toHaveBeenCalled()
            expect(mockRemoveKey).toHaveBeenCalledWith('key-1')
        })
    })

    describe('executeWithKey', () => {
        const makeKey = (overrides?: Partial<KeyPair>): KeyPair => ({
            id: 'key-1',
            publicKey: 'ADDR',
            type: KeyType.Algo25Key,
            privateDataStorageKey: 'algo25-key-ADDR',
            ...overrides,
        })

        const mockStoredData: StoredKeyMaterial = {
            seed: btoa('test-seed'),
            seedFormat: 'base64',
        }

        test('retrieves private key and calls handler', async () => {
            const key = makeKey()
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const handler = vi.fn().mockResolvedValue('result')

            const { result } = renderHook(() => useKMSService())

            let execResult: any
            await act(async () => {
                execResult = await result.current.executeWithKey(
                    key,
                    'test-domain',
                    handler,
                )
            })

            expect(mockGetItem).toHaveBeenCalledWith('algo25-key-ADDR')
            expect(handler).toHaveBeenCalledWith(mockStoredData)
            expect(execResult).toBe('result')
        })

        test('throws KeyAccessError when privateDataStorageKey is missing', async () => {
            const key = makeKey({ privateDataStorageKey: undefined })

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        vi.fn(),
                    )
                }),
            ).rejects.toThrow(KeyAccessError)
        })

        test('throws KeyAccessError when no private key found in storage', async () => {
            const key = makeKey()
            mockGetItem.mockResolvedValue(null)

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        vi.fn(),
                    )
                }),
            ).rejects.toThrow(KeyAccessError)
        })

        test('allows access when ACL grants ReadPrivate for domain', async () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['test-domain'],
                        permissions: [AccessControlPermission.ReadPrivate],
                    },
                ],
            })
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const handler = vi.fn().mockResolvedValue('ok')

            const { result } = renderHook(() => useKMSService())

            let execResult: any
            await act(async () => {
                execResult = await result.current.executeWithKey(
                    key,
                    'test-domain',
                    handler,
                )
            })

            expect(execResult).toBe('ok')
        })

        test('throws KeyAccessError when ACL denies access for domain', async () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['other-domain'],
                        permissions: [AccessControlPermission.ReadPrivate],
                    },
                ],
            })

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        vi.fn(),
                    )
                }),
            ).rejects.toThrow(KeyAccessError)
        })

        test('throws KeyAccessError when ACL lacks ReadPrivate permission', async () => {
            const key = makeKey({
                acl: [
                    {
                        domains: ['test-domain'],
                        permissions: [AccessControlPermission.ReadPublic],
                    },
                ],
            })

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        vi.fn(),
                    )
                }),
            ).rejects.toThrow(KeyAccessError)
        })

        test('skips ACL check when key has no ACL', async () => {
            const key = makeKey({ acl: undefined })
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const handler = vi.fn().mockResolvedValue('ok')

            const { result } = renderHook(() => useKMSService())

            let execResult: any
            await act(async () => {
                execResult = await result.current.executeWithKey(
                    key,
                    'test-domain',
                    handler,
                )
            })

            expect(execResult).toBe('ok')
        })

        test('re-throws AppError from handler without wrapping', async () => {
            const key = makeKey()
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const appError = new KeyAccessError()
            const handler = vi.fn().mockRejectedValue(appError)

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        handler,
                    )
                }),
            ).rejects.toBe(appError)
        })

        test('wraps non-AppError from handler in KeyAccessError', async () => {
            const key = makeKey()
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const genericError = new Error('something broke')
            const handler = vi.fn().mockRejectedValue(genericError)

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        handler,
                    )
                }),
            ).rejects.toThrow(KeyAccessError)
        })

        test('zeros out private key memory after successful execution', async () => {
            const key = makeKey()
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const handler = vi.fn().mockResolvedValue('ok')

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.executeWithKey(key, 'test-domain', handler)
            })

            expect(encoded.every(byte => byte === 0)).toBe(true)
        })

        test('zeros out private key memory even when handler throws', async () => {
            const key = makeKey()
            const encoded = new TextEncoder().encode(
                JSON.stringify(mockStoredData),
            )
            mockGetItem.mockResolvedValue(encoded)

            const handler = vi.fn().mockRejectedValue(new Error('fail'))

            const { result } = renderHook(() => useKMSService())

            try {
                await act(async () => {
                    await result.current.executeWithKey(
                        key,
                        'test-domain',
                        handler,
                    )
                })
            } catch {
                // expected to throw
            }

            // Memory should still be zeroed despite the error
            expect(encoded.every(byte => byte === 0)).toBe(true)
        })
    })
})
