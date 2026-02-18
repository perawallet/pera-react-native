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
vi.mock('../../utils', () => ({
    deleteKey: (...args: any[]) => mockDeleteKey(...args),
    getSeedFromMasterKey: vi.fn(() => new Uint8Array(32).fill(7)),
    getEntropyFromMasterKey: vi.fn(() => null),
    saveKey: vi.fn(async (key: any) => key),
    executeWithKey: vi.fn(),
}))

const mockCreateHDWalletKey = vi.fn()
const mockWithHDSession = vi.fn()

vi.mock('../../crypto/hd-wallet', () => ({
    createHDWalletKey: (...args: any[]) => mockCreateHDWalletKey(...args),
    withHDSession: (...args: any[]) => mockWithHDSession(...args),
    generateHDMasterKey: vi.fn(),
}))

const mockCreateAlgo25Key = vi.fn()
const mockWithAlgo25Session = vi.fn()

vi.mock('../../crypto/algo25', () => ({
    createAlgo25Key: (...args: any[]) => mockCreateAlgo25Key(...args),
    withAlgo25Session: (...args: any[]) => mockWithAlgo25Session(...args),
}))

describe('useKMS', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKeys.clear()
    })

    it('should delete a key via deleteKey from utils', async () => {
        const { result } = renderHook(() => useKMS())

        await act(async () => {
            await result.current.deleteKey('test-id')
        })

        expect(mockDeleteKey).toHaveBeenCalledWith('test-id')
    })

    it('should expose createHDWalletKey from crypto/hd-wallet', async () => {
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

    it('should expose createAlgo25Key from crypto/algo25', async () => {
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

    it('should loadKey and throw if not found', () => {
        mockGetKey.mockReturnValue(null)

        const { result } = renderHook(() => useKMS())

        expect(() => result.current.loadKey('missing-id')).toThrow()
    })

    it('should loadKey successfully when key exists', () => {
        const key: KeyPair = {
            id: 'test-id',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        expect(result.current.loadKey('test-id')).toEqual(key)
    })

    it('should signTransactionWithKey using HD session for HD keys', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signTransaction: vi.fn(async () =>
                        new Uint8Array(64).fill(1),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signTransactionWithKey(
                'hd-key',
                'test-domain',
                new Uint8Array([1, 2, 3]),
                { account: 0, keyIndex: 0, derivationType: 9 },
            )
        })

        expect(signed).toEqual(new Uint8Array(64).fill(1))
        expect(mockWithHDSession).toHaveBeenCalledWith(
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should signTransactionWithKey using Algo25 session for Algo25 keys', async () => {
        const key: KeyPair = {
            id: 'algo-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockGetKey.mockReturnValue(key)
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signTransaction: vi.fn(async () =>
                        new Uint8Array(64).fill(2),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signTransactionWithKey(
                'algo-key',
                'test-domain',
                new Uint8Array([1, 2, 3]),
            )
        })

        expect(signed).toEqual(new Uint8Array(64).fill(2))
        expect(mockWithAlgo25Session).toHaveBeenCalledWith(
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw InvalidKeyError for HD sign without derivationParams', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signTransactionWithKey(
                    'hd-key',
                    'test-domain',
                    new Uint8Array([1, 2, 3]),
                )
            }),
        ).rejects.toThrow()
    })

    it('should batchSignTransactionWithKey for multiple transactions', async () => {
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
            signed = await result.current.batchSignTransactionWithKey(
                'hd-key',
                'test-domain',
                [new Uint8Array([1]), new Uint8Array([2])],
                { account: 0, keyIndex: 0, derivationType: 9 },
            )
        })

        expect(signed).toHaveLength(2)
    })

    it('should not expose saveKey, executeWithKey, or executeWithSeed', () => {
        const { result } = renderHook(() => useKMS())

        expect(result.current).not.toHaveProperty('saveKey')
        expect(result.current).not.toHaveProperty('executeWithKey')
        expect(result.current).not.toHaveProperty('executeWithSeed')
        expect(result.current).not.toHaveProperty('getKey')
    })

    it('should signDataWithKey using HD session for HD keys', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signData: vi.fn(async () => new Uint8Array(64).fill(3)),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signDataWithKey(
                'hd-key',
                'test-domain',
                new Uint8Array([1, 2, 3]),
                { account: 0, keyIndex: 0, derivationType: 9 },
            )
        })

        expect(signed).toEqual(new Uint8Array(64).fill(3))
        expect(mockWithHDSession).toHaveBeenCalledWith(
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should signDataWithKey using Algo25 session for Algo25 keys', async () => {
        const key: KeyPair = {
            id: 'algo-key',
            publicKey: 'pub',
            type: KeyType.Algo25Key,
        }
        mockGetKey.mockReturnValue(key)
        mockWithAlgo25Session.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signData: vi.fn(async () => new Uint8Array(64).fill(4)),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signDataWithKey(
                'algo-key',
                'test-domain',
                new Uint8Array([1, 2, 3]),
            )
        })

        expect(signed).toEqual(new Uint8Array(64).fill(4))
        expect(mockWithAlgo25Session).toHaveBeenCalledWith(
            key,
            'test-domain',
            expect.any(Function),
        )
    })

    it('should throw InvalidKeyError for HD signData without derivationParams', async () => {
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
                    new Uint8Array([1, 2, 3]),
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw InvalidKeyError for signTransactionWithKey with unsupported key type', async () => {
        const key: KeyPair = {
            id: 'p256-key',
            publicKey: 'pub',
            type: KeyType.DeterministicP256Key,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.signTransactionWithKey(
                    'p256-key',
                    'test-domain',
                    new Uint8Array([1, 2, 3]),
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw InvalidKeyError for signDataWithKey with unsupported key type', async () => {
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
                    new Uint8Array([1, 2, 3]),
                )
            }),
        ).rejects.toThrow()
    })

    it('should batchSignTransactionWithKey using Algo25 session', async () => {
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
            signed = await result.current.batchSignTransactionWithKey(
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

    it('should throw for batchSignTransactionWithKey with HD key without derivationParams', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.batchSignTransactionWithKey(
                    'hd-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should batchSignDataWithKey using HD session', async () => {
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
            signed = await result.current.batchSignDataWithKey(
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

    it('should batchSignDataWithKey using Algo25 session', async () => {
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
            signed = await result.current.batchSignDataWithKey(
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

    it('should throw for batchSignDataWithKey with HD key without derivationParams', async () => {
        const key: KeyPair = {
            id: 'hd-key',
            publicKey: 'pub',
            type: KeyType.HDWalletRootKey,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.batchSignDataWithKey(
                    'hd-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw for batchSignTransactionWithKey with unsupported key type', async () => {
        const key: KeyPair = {
            id: 'p256-key',
            publicKey: 'pub',
            type: KeyType.DeterministicP256Key,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.batchSignTransactionWithKey(
                    'p256-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should throw for batchSignDataWithKey with unsupported key type', async () => {
        const key: KeyPair = {
            id: 'p256-key',
            publicKey: 'pub',
            type: KeyType.DeterministicP256Key,
        }
        mockGetKey.mockReturnValue(key)

        const { result } = renderHook(() => useKMS())

        await expect(
            act(async () => {
                await result.current.batchSignDataWithKey(
                    'p256-key',
                    'test-domain',
                    [new Uint8Array([1])],
                )
            }),
        ).rejects.toThrow()
    })

    it('should signTransactionWithKey for HDWalletDerivedKey type', async () => {
        const key: KeyPair = {
            id: 'hd-derived',
            publicKey: 'pub',
            type: KeyType.HDWalletDerivedKey,
        }
        mockGetKey.mockReturnValue(key)
        mockWithHDSession.mockImplementation(
            async (_key: any, _domain: string, handler: any) => {
                const mockSession = {
                    signTransaction: vi.fn(async () =>
                        new Uint8Array(64).fill(5),
                    ),
                }
                return handler(mockSession)
            },
        )

        const { result } = renderHook(() => useKMS())

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signTransactionWithKey(
                'hd-derived',
                'test-domain',
                new Uint8Array([1, 2, 3]),
                { account: 0, keyIndex: 1, derivationType: 9 },
            )
        })

        expect(signed).toEqual(new Uint8Array(64).fill(5))
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
