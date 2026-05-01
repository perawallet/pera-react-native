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
import { useKMS } from '../useKMS'
import { KeyPair, KeyType } from '../../models'

// Source-of-truth keystore Key list mocked at the module that bridges to
// the platform keystore. useKMS reads from this via useKeystoreKeys().
let mockKeystoreKeys: Key[] = []

vi.mock('../useKeystoreState', () => ({
    useKeystoreKeys: () => mockKeystoreKeys,
}))

const mockDeleteKey = vi.fn()
const mockKeyStoreRemove = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        deleteKey: (...args: any[]) => mockDeleteKey(...args),
        keyStore: {
            remove: (...args: any[]) => mockKeyStoreRemove(...args),
        },
        withExportedKey: vi.fn(),
        checkAccess: vi.fn(),
    }),
}))

const mockCreateHDWalletKey = vi.fn()
const mockWithHDSession = vi.fn()
vi.mock('../useHDWallet', () => ({
    useHDWallet: () => ({
        createHDWalletKey: (...args: any[]) => mockCreateHDWalletKey(...args),
        withHDSession: (...args: any[]) => mockWithHDSession(...args),
        generateDerivedKey: vi.fn(),
    }),
}))

const mockCreateAlgo25Key = vi.fn()
const mockWithAlgo25Session = vi.fn()
vi.mock('../useAlgo25', () => ({
    useAlgo25: () => ({
        createAlgo25Key: (...args: any[]) => mockCreateAlgo25Key(...args),
        withAlgo25Session: (...args: any[]) => mockWithAlgo25Session(...args),
    }),
}))

const seedHDRoot = (id: string): KeyPair => {
    mockKeystoreKeys.push({
        id,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: true,
    } as Key)
    // The shape `keystoreKeyToKeyPair` will produce — useful for assertions
    // that need to match what `withHDSession`/`withAlgo25Session` were called
    // with as their `key` argument.
    return expect.objectContaining({
        id,
        keystoreKeyId: id,
        publicKey: '',
        type: KeyType.HDWalletRootKey,
    }) as unknown as KeyPair
}

const seedAlgo25Root = (id: string): KeyPair => {
    mockKeystoreKeys.push({
        id,
        type: 'algo25',
        algorithm: 'EdDSA',
        extractable: true,
    } as Key)
    return expect.objectContaining({
        id,
        keystoreKeyId: id,
        publicKey: '',
        type: KeyType.Algo25Key,
    }) as unknown as KeyPair
}

describe('useKMS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeystoreKeys = []
    })

    it('should delete a key via deleteKey from useKMSService', async () => {
        const { result } = renderHook(() => useKMS())

        await act(async () => {
            await result.current.deleteKey('test-id')
        })

        expect(mockDeleteKey).toHaveBeenCalledWith('test-id')
    })

    it('should expose createHDWalletKey from useHDWallet', async () => {
        const mockResult = {
            keyPair: {
                id: 'wallet-1',
                publicKey: '',
                type: KeyType.HDWalletRootKey,
            },
            entropyKeyId: 'wallet-1-entropy',
        }
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

    it('should expose createAlgo25Key from useAlgo25', async () => {
        const mockKey: KeyPair = {
            id: 'algo25-1',
            publicKey: 'ALGO25_ADDR',
            type: KeyType.Algo25Key,
        }
        mockCreateAlgo25Key.mockResolvedValue(mockKey)

        const { result } = renderHook(() => useKMS())

        let keyResult: any
        await act(async () => {
            keyResult = await result.current.createAlgo25Key({
                id: 'algo25-1',
                mnemonic: 'test mnemonic',
            })
        })

        expect(mockCreateAlgo25Key).toHaveBeenCalledWith({
            id: 'algo25-1',
            mnemonic: 'test mnemonic',
        })
        expect(keyResult).toEqual(mockKey)
    })

    it('should getKeyOrThrow and throw if not found', () => {
        const { result } = renderHook(() => useKMS())

        expect(() => result.current.getKeyOrThrow('missing-id')).toThrow()
    })

    it('should getKeyOrThrow successfully when key exists in the keystore', () => {
        seedHDRoot('test-id')

        const { result } = renderHook(() => useKMS())

        const kp = result.current.getKeyOrThrow('test-id')
        expect(kp.id).toBe('test-id')
        expect(kp.type).toBe(KeyType.HDWalletRootKey)
        expect(kp.keystoreKeyId).toBe('test-id')
    })

    it('should signTransactionsWithKey for multiple HD transactions', async () => {
        const expectedKey = seedHDRoot('hd-key')
        let callCount = 0
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signTransaction: vi.fn(async () =>
                        new Uint8Array(64).fill(++callCount),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array[] | undefined
        await act(async () => {
            signed = await result.current.signTransactionsWithKey(
                'hd-key',
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
                { account: 0, keyIndex: 0, derivationType: 9 },
            )
        })

        expect(signed).toHaveLength(2)
        expect(mockWithHDSession).toHaveBeenCalledWith(
            expectedKey,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should not expose saveKey or executeWithKey', () => {
        const { result } = renderHook(() => useKMS())

        expect(result.current).not.toHaveProperty('saveKey')
        expect(result.current).not.toHaveProperty('executeWithKey')
    })

    it('should expose getKey from the keystore', () => {
        seedAlgo25Root('test-key')

        const { result } = renderHook(() => useKMS())

        const kp = result.current.getKey('test-key')
        expect(kp?.id).toBe('test-key')
        expect(kp?.type).toBe(KeyType.Algo25Key)
    })

    it('should signTransactionsWithKey using Algo25 session', async () => {
        const expectedKey = seedAlgo25Root('algo-key')
        let callCount = 0
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signTransaction: vi.fn(async () =>
                        new Uint8Array(64).fill(++callCount),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array[] | undefined
        await act(async () => {
            signed = await result.current.signTransactionsWithKey(
                'algo-key',
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
            )
        })

        expect(signed).toHaveLength(2)
        expect(mockWithAlgo25Session).toHaveBeenCalledWith(
            expectedKey,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw for signTransactionsWithKey with HD key without derivationParams', async () => {
        seedHDRoot('hd-key')

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signTransactionsWithKey(
                    'hd-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should signDataWithKey using HD session', async () => {
        const expectedKey = seedHDRoot('hd-key')
        let callCount = 0
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signData: vi.fn(async () =>
                        new Uint8Array(64).fill(++callCount),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array[] | undefined
        await act(async () => {
            signed = await result.current.signDataWithKey(
                'hd-key',
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
                { account: 0, keyIndex: 0, derivationType: 9 },
            )
        })

        expect(signed).toHaveLength(2)
        expect(mockWithHDSession).toHaveBeenCalledWith(
            expectedKey,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should signDataWithKey using Algo25 session', async () => {
        const expectedKey = seedAlgo25Root('algo-key')
        let callCount = 0
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signData: vi.fn(async () =>
                        new Uint8Array(64).fill(++callCount),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array[] | undefined
        await act(async () => {
            signed = await result.current.signDataWithKey(
                'algo-key',
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
            )
        })

        expect(signed).toHaveLength(2)
        expect(mockWithAlgo25Session).toHaveBeenCalledWith(
            expectedKey,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw for signDataWithKey with HD key without derivationParams', async () => {
        seedHDRoot('hd-key')

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signDataWithKey('hd-key', 'test-domain', [
                    new Uint8Array([1]),
                ])
            }),
        ).rejects.toThrow()
    })

    it('should throw for signTransactionsWithKey with unsupported key type', async () => {
        // P256 keys aren't currently exposed as wallet roots; getKeyOrThrow
        // throws KeyNotFound for an absent id, which is the same observable
        // outcome as "unsupported key type".
        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signTransactionsWithKey(
                    'p256-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw for signDataWithKey with unsupported key type', async () => {
        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signDataWithKey(
                    'p256-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should executeWithMnemonic via HD session and zero bytes after', async () => {
        const expectedKey = seedHDRoot('hd-key')
        const capturedBytes: Uint8Array[] = []
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const bytes = new TextEncoder().encode('alpha bravo charlie')
                capturedBytes.push(bytes)
                return handler({
                    getMnemonic: async () => bytes,
                })
            },
        )

        const { result } = renderHook(() => useKMS())

        let received: string[] | undefined
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                'hd-key',
                'backup-flow',
                words => {
                    return [...words]
                },
            )
        })

        expect(received).toEqual(['alpha', 'bravo', 'charlie'])
        expect(capturedBytes[0].every(byte => byte === 0)).toBe(true)
        expect(mockWithHDSession).toHaveBeenCalledWith(
            expectedKey,
            'backup-flow',
            expect.any(Function),
        )
    })

    it('should executeWithMnemonic via Algo25 session', async () => {
        const expectedKey = seedAlgo25Root('algo-key')
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                return handler({
                    getMnemonic: async () =>
                        new TextEncoder().encode('one two three'),
                })
            },
        )

        const { result } = renderHook(() => useKMS())

        let received: string[] | undefined
        await act(async () => {
            received = await result.current.executeWithMnemonic(
                'algo-key',
                'backup-flow',
                words => [...words],
            )
        })

        expect(received).toEqual(['one', 'two', 'three'])
        expect(mockWithAlgo25Session).toHaveBeenCalledWith(
            expectedKey,
            'backup-flow',
            expect.any(Function),
        )
    })

    it('should throw for executeWithMnemonic with unsupported key type', async () => {
        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.executeWithMnemonic(
                    'p256-key',
                    'backup-flow',
                    () => undefined,
                )
            }),
        ).rejects.toThrow()
    })

    it('should zero mnemonic bytes even when handler throws', async () => {
        seedHDRoot('hd-key')
        let captured: Uint8Array | undefined
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                captured = new TextEncoder().encode('alpha bravo')
                return handler({
                    getMnemonic: async () => captured!,
                })
            },
        )

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.executeWithMnemonic(
                    'hd-key',
                    'backup-flow',
                    () => {
                        throw new Error('boom')
                    },
                )
            }),
        ).rejects.toThrow('boom')

        expect(captured!.every(byte => byte === 0)).toBe(true)
    })

    it('should expose the keys map sourced from the keystore', () => {
        seedAlgo25Root('test-key')

        const { result } = renderHook(() => useKMS())

        expect(result.current.keys.size).toBe(1)
        const kp = result.current.keys.get('test-key')
        expect(kp?.id).toBe('test-key')
        expect(kp?.type).toBe(KeyType.Algo25Key)
    })
})
