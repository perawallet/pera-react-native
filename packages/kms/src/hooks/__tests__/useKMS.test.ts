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
import { useKMS } from '../useKMS'
import { KeyPair, KeyType } from '../../models'

const mockAddKey = vi.fn()
const mockRemoveKey = vi.fn()
const mockGetKey = vi.fn()
const mockKeys = new Map<string, KeyPair>()

vi.mock('../../store', () => ({
    useKeyManagerStore: (selector: any) => {
        const state = {
            keys: mockKeys,
            addKey: mockAddKey,
            removeKey: mockRemoveKey,
            getKey: mockGetKey,
        }
        return selector(state)
    },
}))

const mockDeleteKey = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        deleteKey: (...args: any[]) => mockDeleteKey(...args),
    }),
}))

const mockCreateHDWalletKey = vi.fn()
const mockWithHDSession = vi.fn()

vi.mock('../useHDWallet', () => ({
    useHDWallet: () => ({
        createHDWalletKey: (...args: any[]) => mockCreateHDWalletKey(...args),
        withHDSession: (...args: any[]) => mockWithHDSession(...args),
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

describe('useKMS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeys.clear()
    })

    it('should delete a key via deleteKey from useKMSService', async () => {
        const { result } = renderHook(() => useKMS())

        await act(async () => {
            await result.current.deleteKey('test-id')
        })

        expect(mockDeleteKey).toHaveBeenCalledWith('test-id')
    })

    it('should expose createHDWalletKey from useHDWallet', async () => {
        const mockKey: KeyPair = {
            id: 'wallet-1',
            publicKey: '',
            type: KeyType.HDWalletRootKey,
        }
        mockCreateHDWalletKey.mockResolvedValue(mockKey)

        const { result } = renderHook(() => useKMS())

        let keyResult: any
        await act(async () => {
            keyResult = await result.current.createHDWalletKey({
                id: 'wallet-1',
            })
        })

        expect(mockCreateHDWalletKey).toHaveBeenCalledWith({ id: 'wallet-1' })
        expect(keyResult).toEqual(mockKey)
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
        mockGetKey.mockReturnValue(null)

        const { result } = renderHook(() => useKMS())

        expect(() => result.current.getKeyOrThrow('missing-id')).toThrow()
    })

    it('should getKeyOrThrow successfully when key exists', () => {
        const key: KeyPair = {
            id: 'test-id',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        expect(result.current.getKeyOrThrow('test-id')).toEqual(key)
    })

    it('should signTransactionsWithKey for multiple transactions', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)
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
    })

    it('should not expose saveKey or executeWithKey', () => {
        const { result } = renderHook(() => useKMS())

        expect(result.current).not.toHaveProperty('saveKey')
        expect(result.current).not.toHaveProperty('executeWithKey')
    })

    it('should expose getKey from the store', () => {
        const key: KeyPair = {
            id: 'test-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        expect(result.current.getKey('test-key')).toEqual(key)
    })

    it('should signTransactionsWithKey using Algo25 session', async () => {
        const key: KeyPair = {
            id: 'algo-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockGetKey.mockReturnValue(key)
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
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw for signTransactionsWithKey with HD key without derivationParams', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

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
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)
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
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should signDataWithKey using Algo25 session', async () => {
        const key: KeyPair = {
            id: 'algo-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockGetKey.mockReturnValue(key)
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
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw for signDataWithKey with HD key without derivationParams', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signDataWithKey(
                    'hd-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw for signTransactionsWithKey with unsupported key type', async () => {
        const key: KeyPair = {
            id: 'p256-key',
            publicKey: 'pub',
            type: KeyType.DeterministicP256Key,
        }
        mockGetKey.mockReturnValue(key)

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
        const key: KeyPair = {
            id: 'p256-key',
            publicKey: 'pub',
            type: KeyType.DeterministicP256Key,
        }
        mockGetKey.mockReturnValue(key)

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

    it('should expose the keys map from the store', () => {
        const key: KeyPair = {
            id: 'test-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockKeys.set('test-key', key)

        const { result } = renderHook(() => useKMS())

        expect(result.current.keys.size).toBe(1)
        expect(result.current.keys.get('test-key')).toEqual(key)
    })
})
