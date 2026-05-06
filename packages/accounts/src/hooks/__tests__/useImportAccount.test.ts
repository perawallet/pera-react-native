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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import { KeyType } from '@perawallet/wallet-core-kms'

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {},
    fromSeed: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
        Buffer.from(address).toString('base64'),
    ),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...actual,
        generateOrderedUniqueId: uuidSpies.v7,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const mockKeyStoreExport = vi.fn()

const kmsMock = vi.hoisted(() => ({
    getKey: vi.fn(),
    getKeyOrThrow: vi.fn(),
    createHDWalletKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    persistHDMasterKey: vi.fn(),
    generateDerivedKey: vi.fn(),
    withExportedKey: vi.fn(),
}))

const prepareHDMasterKeyMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => kmsMock),
        prepareHDMasterKey: prepareHDMasterKeyMock,
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useUpdateDeviceMutation: vi.fn(() => ({
        mutateAsync: vi.fn(async () => ({})),
    })),
    useDeviceID: vi.fn(() => 'device-id'),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => 'ios',
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
        secureStorage: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        },
    }),
}))

describe('useImportAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        kmsMock.getKey.mockReset()
        kmsMock.getKeyOrThrow.mockReset()
        kmsMock.createHDWalletKey.mockReset()
        kmsMock.createAlgo25Key.mockReset()
        kmsMock.generateDerivedKey.mockReset()
        kmsMock.withExportedKey.mockReset()
        mockKeyStoreExport.mockReset()

        kmsMock.getKey.mockReturnValue(null)
        kmsMock.getKeyOrThrow.mockReturnValue(null)
        kmsMock.createHDWalletKey.mockResolvedValue({
            keyPair: {
                id: 'WALLET1',
                type: KeyType.HDWalletRootKey,
                publicKey: '',
                keystoreKeyId: 'ks-root-1',
            },
            entropyKeyId: 'ks-entropy-1',
        })
        kmsMock.createAlgo25Key.mockResolvedValue({
            keyPair: {
                id: 'WALLET1',
                type: KeyType.Algo25Key,
                publicKey: 'ALGO25_PUBLIC_KEY',
            },
            seedKeyId: 'ks-seed-1',
        })
        kmsMock.generateDerivedKey.mockResolvedValue('ks-derived-1')
        mockKeyStoreExport.mockResolvedValue({
            publicKey: new Uint8Array(32).fill(2),
        })
        kmsMock.withExportedKey.mockImplementation(
            async (keyId: string, handler: (keyData: any) => any) => {
                const keyData = await mockKeyStoreExport(keyId)
                return handler(keyData)
            },
        )
        prepareHDMasterKeyMock.mockReset()
        prepareHDMasterKeyMock.mockResolvedValue({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
            mnemonic: 'test mnemonic',
        })
    })

    test('hd wallet path: prepares import session, does not create an account', async () => {
        prepareHDMasterKeyMock.mockResolvedValueOnce({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
            mnemonic: 'test mnemonic',
        })

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'hdWallet',
            })
        })

        expect(imported.type).toBe('hdWallet')
        expect(imported.walletKeyId).toBe('WALLET1')
        expect(imported.derivationType).toBe(9)
        // No WalletAccount should have been pushed to the store yet.
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        // createHDWalletKey must not be called in the new flow.
        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
    })

    test('hd wallet path: surfaces prepareHDMasterKey errors', async () => {
        prepareHDMasterKeyMock.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'invalid mnemonic',
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('imports algo25 account with mnemonic', async () => {
        // createAlgo25Key returns { keyPair, seedKeyId }
        // Then createAlgo25WalletAccount is called with id + seedKeyId
        // getKey returns the existing key so createAlgo25Key isn't called again
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            keyPair: {
                id: 'WALLET1',
                type: KeyType.Algo25Key,
                publicKey: 'ALGO25_PUBLIC_KEY',
            },
            seedKeyId: 'ks-seed-1',
        })
        kmsMock.getKey.mockReturnValueOnce({
            id: 'WALLET1',
            type: KeyType.Algo25Key,
            publicKey: 'ALGO25_PUBLIC_KEY',
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(imported.address).toBe('ALGO25_PUBLIC_KEY')
        expect(imported.type).toBe('algo25')
        expect(imported.keyPairId).toBe('WALLET1')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('uses the keyPair from createAlgo25Key without consulting getKey (regression: stale useMemo)', async () => {
        // Simulate the stale-useMemo race: the freshly-minted key isn't yet
        // visible to getKey, which reads from a useMemo bound to the previous
        // render. Without passing the keyPair through, the import would fall
        // back to creating a new no-mnemonic key (random address).
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            keyPair: {
                id: 'WALLET1',
                type: KeyType.Algo25Key,
                publicKey: 'CORRECT_ADDRESS',
            },
            seedKeyId: 'ks-seed-1',
        })
        kmsMock.getKey.mockReturnValue(null)

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonic: 'test mnemonic',
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledTimes(1)
        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonic: 'test mnemonic',
        })
        expect(kmsMock.getKey).not.toHaveBeenCalled()
        expect(imported.address).toBe('CORRECT_ADDRESS')
        expect(imported.keyPairId).toBe('WALLET1')
    })

    test('throws when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Import failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonic: 'test mnemonic',
                    type: 'algo25',
                }),
            ).rejects.toThrow('Import failed')
        })
    })
})
