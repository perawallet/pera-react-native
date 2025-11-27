import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import { registerTestPlatform, MemoryKeyValueStorage } from '@perawallet/wallet-core-platform-integration'

// Mocks (similar to useCreateAccount)
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
    deriveSpy: vi.fn(),
    keyGenSpy: vi.fn(),
    signTransactionSpy: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}))

const xhdSpies = vi.hoisted(() => ({ fromSeed: vi.fn(() => 'ROOT_KEY') }))

vi.mock('@perawallet/wallet-core-xhdwallet', () => ({
    BIP32DerivationType: { Peikert: 'PEIKERT' },
    BIP32DerivationTypes: { Peikert: 9 },
    fromSeed: xhdSpies.fromSeed,
    KeyContext: { Address: 'Address' },
    KeyContexts: { Address: 0 },
    XHDWalletAPI: class {
        deriveKey = apiSpies.deriveSpy
        keyGen = apiSpies.keyGenSpy
        signAlgoTransaction = apiSpies.signTransactionSpy
    },
}))

const bip39Spies = vi.hoisted(() => ({
    generateMnemonic: vi.fn(() => 'test mnemonic'),
    mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
    mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
    mnemonicToEntropy: vi.fn(async () => Buffer.from('entropy')),
}))
vi.mock('bip39', () => bip39Spies)

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<typeof import('@perawallet/wallet-core-shared')>('@perawallet/wallet-core-shared')
    return {
        ...actual,
        encodeAlgorandAddress: vi.fn((address: Uint8Array) => Buffer.from(address).toString('base64')),
    }
})

vi.mock('@perawallet/wallet-core-platform-integration', async () => {
    const actual = await vi.importActual<typeof import('@perawallet/wallet-core-platform-integration')>('@perawallet/wallet-core-platform-integration')
    return {
        ...actual,
        useKeyValueStorageService: vi.fn().mockReturnValue({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
        useUpdateDeviceMutation: vi.fn(() => ({ mutateAsync: vi.fn(async () => ({})) })),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
        useDeviceID: vi.fn(() => 'device-id'),
    }
})

// Mock API hooks
vi.mock('../../../api/generated/backend', () => ({
    useV1DevicesPartialUpdate: vi.fn(() => ({ mutateAsync: vi.fn() })),
}))

vi.mock('../../store', async () => {
    const actual = await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAccountsStore: actual.createAccountsStore(mockStorage as any),
    }
})

describe('useImportAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('imports account and persists keys', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({ mnemonic: 'test mnemonic' })
        })

        expect(imported).toMatchObject({
            privateKeyLocation: 'pk-KEY1',
        })
        expect(imported.address).toBeTruthy()
        expect(imported.id).toBeTruthy()

        expect(dummySecure.setItem).toHaveBeenCalledWith('rootkey-WALLET1', expect.any(Buffer))
        expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY1', expect.any(Buffer))
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws error when generateMasterKey fails with invalid mnemonic', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Make bip39 throw on invalid mnemonic
        bip39Spies.mnemonicToSeed.mockRejectedValueOnce(new Error('Invalid mnemonic'))

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'invalid mnemonic' })).rejects.toThrow('Invalid mnemonic')
        })
    })

    test('throws error when deriveKey fails', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // Make deriveKey throw an error
        apiSpies.deriveSpy.mockRejectedValueOnce(new Error('Key derivation failed'))

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'test mnemonic' })).rejects.toThrow('Key derivation failed')
        })
    })

    test('throws error when secure storage setItem fails for root key', async () => {
        const dummySecure = {
            setItem: vi.fn()
                .mockRejectedValueOnce(new Error('Storage full')), // First call for root key fails
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'test mnemonic' })).rejects.toThrow('Storage full')
        })
    })

    test('throws error when secure storage setItem fails for private key', async () => {
        const dummySecure = {
            setItem: vi.fn()
                .mockResolvedValueOnce(undefined) // First call for root key succeeds
                .mockRejectedValueOnce(new Error('Cannot store private key')), // Second call for private key fails
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'test mnemonic' })).rejects.toThrow('Cannot store private key')
        })
    })

    test('throws error when mnemonicToEntropy fails', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        bip39Spies.mnemonicToSeed.mockResolvedValueOnce(Buffer.from('seed'))
        bip39Spies.mnemonicToEntropy.mockRejectedValueOnce(new Error('Invalid entropy'))

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'test mnemonic' })).rejects.toThrow('Invalid entropy')
        })
    })

    test('imports account with custom walletId', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array(32).fill(1)
        const addr = new Uint8Array(32).fill(2)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                walletId: 'CUSTOM_WALLET',
                mnemonic: 'test mnemonic'
            })
        })

        expect(imported).toBeTruthy()
        expect(imported.hdWalletDetails?.walletId).toBe('CUSTOM_WALLET')
        expect(dummySecure.setItem).toHaveBeenCalledWith('rootkey-CUSTOM_WALLET', expect.any(Buffer))
        expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY1', expect.any(Buffer))
    })

    test('throws error when address generation fails', async () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array(32).fill(1)
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockRejectedValueOnce(new Error('Address generation failed'))

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(result.current({ mnemonic: 'test mnemonic' })).rejects.toThrow('Address generation failed')
        })
    })
})
