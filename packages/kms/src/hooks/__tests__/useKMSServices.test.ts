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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { Key } from '@algorandfoundation/keystore-core'
import { useKMSService, checkAccess } from '../useKMSServices'
import { AccessControlPermission } from '../../models'
import { SeedScheme } from '../../constants'
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
        const makeKey = (
            acl?: { domains: string[]; permissions: string[] }[],
        ): Key => ({
            id: 'key-1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            metadata: {
                scheme: SeedScheme.Algo25,
                pera: acl !== undefined ? { acl } : {},
            },
        })

        test('allows access when ACL grants ReadPrivate for domain', () => {
            const key = makeKey([
                {
                    domains: ['test-domain'],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ])

            expect(() => checkAccess(key, 'test-domain')).not.toThrow()
        })

        test('throws KeyAccessError when ACL denies access for domain', () => {
            const key = makeKey([
                {
                    domains: ['other-domain'],
                    permissions: [AccessControlPermission.ReadPrivate],
                },
            ])

            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('throws KeyAccessError when ACL lacks ReadPrivate permission', () => {
            const key = makeKey([
                {
                    domains: ['test-domain'],
                    permissions: [AccessControlPermission.ReadPublic],
                },
            ])

            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('fails closed for a foreign domain when key has no ACL metadata', () => {
            const key = makeKey()
            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('fails closed for a foreign domain when key has empty ACL', () => {
            const key = makeKey([])
            expect(() => checkAccess(key, 'test-domain')).toThrow(
                KeyAccessError,
            )
        })

        test('grants the wallet own-origin domains by default when no ACL is set', () => {
            // Existing seeds (empty/absent ACL) must keep working for the
            // wallet's own signing + backup flows.
            const noAclKey = makeKey()
            const emptyAclKey = makeKey([])
            for (const key of [noAclKey, emptyAclKey]) {
                expect(() => checkAccess(key, 'pera.accounts')).not.toThrow()
                expect(() => checkAccess(key, 'backup-flow')).not.toThrow()
            }
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
            const privateKey = new Uint8Array(64).fill(2)
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey,
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

        test('zeroes and drops the exported private key after the handler completes', async () => {
            const privateKey = new Uint8Array(64).fill(2)
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey,
            }
            mockKeyStoreExport.mockResolvedValue(mockKeyData)

            const { result } = renderHook(() => useKMSService())

            await act(async () => {
                await result.current.withExportedKey('ks-key-1', () => 'done')
            })

            expect(privateKey.every(byte => byte === 0)).toBe(true)
            expect(mockKeyData).not.toHaveProperty('privateKey')
        })

        test('zeroes and drops the exported private key even when the handler throws', async () => {
            const privateKey = new Uint8Array(64).fill(2)
            const mockKeyData = {
                publicKey: new Uint8Array(32).fill(1),
                privateKey,
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

            expect(privateKey.every(byte => byte === 0)).toBe(true)
            expect(mockKeyData).not.toHaveProperty('privateKey')
        })

        test('works with async handlers', async () => {
            const privateKey = new Uint8Array(64).fill(3)
            const mockKeyData = {
                privateKey,
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
            expect(privateKey.every(byte => byte === 0)).toBe(true)
            expect(mockKeyData).not.toHaveProperty('privateKey')
        })
    })
})
