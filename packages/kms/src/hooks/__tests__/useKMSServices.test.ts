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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useKMSService, checkAccess } from '../useKMSServices'
import { AccessControlPermission, KeyPair, KeyType } from '../../models'
import { KeyAccessError } from '../../errors'

const mockKeyStoreRemove = vi.fn()
const mockKeyStoreImport = vi.fn()
const mockKeyStoreSign = vi.fn()
const mockKeyStoreExport = vi.fn()

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        key: {
            store: {
                remove: mockKeyStoreRemove,
                import: mockKeyStoreImport,
                sign: mockKeyStoreSign,
                export: mockKeyStoreExport,
            },
        },
    }),
}))

const mockClearKeyData = vi.fn()

vi.mock('@algorandfoundation/keystore', () => ({
    clearKeyData: (...args: any[]) => mockClearKeyData(...args),
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

    describe('deleteKey', () => {
        test('removes key from keystore by id', async () => {
            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.deleteKey('key-1')
            })

            expect(mockKeyStoreRemove).toHaveBeenCalledWith('key-1')
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

    describe('withExportedKey', () => {
        test('exports key, passes it to handler, and returns result', async () => {
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey: new Uint8Array(64).fill(2),
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useKMSService())

            let handlerResult: Optional<Uint8Array>
            await act(async () => {
                handlerResult = await result.current.withExportedKey(
                    'ks-key-1',
                    keyData => keyData.publicKey!,
                )
            })

            expect(mockKeyStoreExport).toHaveBeenCalledWith('ks-key-1')
            expect(handlerResult).toBe(mockKeyData.publicKey)
        })

        test('calls clearKeyData after handler completes', async () => {
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey: new Uint8Array(64).fill(2),
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.withExportedKey('ks-key-1', () => 'done')
            })

            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })

        test('calls clearKeyData even when handler throws', async () => {
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey: new Uint8Array(64).fill(2),
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useKMSService())

            await expect(
                act(async () => {
                    await result.current.withExportedKey('ks-key-1', () => {
                        throw new Error('handler failed')
                    })
                }),
            ).rejects.toThrow('handler failed')

            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })

        test('works with async handlers', async () => {
            const mockKeyData = {
                privateKey: new Uint8Array(64).fill(3),
                metadata: { mnemonic: 'test words' },
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useKMSService())

            let mnemonic: Optional<string>
            await act(async () => {
                mnemonic = await result.current.withExportedKey(
                    'ks-key-1',
                    async keyData => {
                        return keyData.metadata?.mnemonic as string
                    },
                )
            })

            expect(mnemonic).toBe('test words')
            expect(mockClearKeyData).toHaveBeenCalledWith(mockKeyData)
        })
    })
})
