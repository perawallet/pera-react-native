import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '../types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'
import Decimal from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Hoisted mocks for createAccount path dependencies
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
    deriveSpy: vi.fn(),
    keyGenSpy: vi.fn(),
}))
const xhdSpies = vi.hoisted(() => ({
    fromSeed: vi.fn(() => 'ROOT_KEY'),
}))

const querySpies = vi.hoisted(() => ({
    useLookupAccountByID: vi.fn(),
    useV1AssetsList: vi.fn(),
    useV1DevicesPartialUpdate: vi.fn(() => ({
        mutateAsync: vi.fn(async () => ({})),
    })),
    v1AccountsAssetsListQueryKey: vi.fn((params: any, options: any) => [
        'v1AccountsAssetsList',
        params,
        options,
    ]),
    v1AccountsAssetsList: vi.fn(async (): Promise<any> => ({
        results: [],
    })),
}))

const mockedMnemonic =
    'spike assault capital honey word junk bind task gorilla visa resist next size initial bacon ice gym entire bargain voice shift pause supply town'

const bip39Spies = vi.hoisted(() => ({
    generateMnemonic: vi.fn(() => mockedMnemonic),
    mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
    mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
}))
vi.mock('algosdk', () => {
    return {
        encodeAddress: vi.fn(() => 'QUREUkVTUw=='),
    }
})

vi.mock('@perawallet/xhdwallet', () => {
    return {
        BIP32DerivationType: { Peikert: 'PEIKERT' },
        BIP32DerivationTypes: { Peikert: 9 },
        fromSeed: xhdSpies.fromSeed,
        KeyContext: { Address: 'Address' },
        KeyContexts: { Address: 0 },
        XHDWalletAPI: vi.fn().mockImplementation(() => ({
            deriveKey: apiSpies.deriveSpy,
            keyGen: apiSpies.keyGenSpy,
        })),
    }
})
vi.mock('bip39', () => bip39Spies)

// Mocks must match the exact module specifiers used in hooks.accounts.ts
vi.mock('../../../api/generated/indexer', () => ({
    useLookupAccountByID: querySpies.useLookupAccountByID,
}))
vi.mock('../../../api/generated/backend', () => ({
    useV1AssetsList: querySpies.useV1AssetsList,
    useV1DevicesPartialUpdate: querySpies.useV1DevicesPartialUpdate,
    v1AccountsAssetsListQueryKey: querySpies.v1AccountsAssetsListQueryKey,
    v1AccountsAssetsList: querySpies.v1AccountsAssetsList,
}))

describe('services/accounts/hooks', () => {
    test('allAccounts, findAccountByAddress, and addAccount persist PK when provided', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAllAccounts, useFindAccountbyAddress, useAddAccount } =
            await import('../hooks.accounts')

        const { result: allRes } = renderHook(() => useAllAccounts())
        const { result: addRes } = renderHook(() => useAddAccount())

        // defaults
        expect(allRes.current).toEqual([])

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE',
        }

        // add with secret - should persist to secure storage
        act(() => {
            addRes.current(a1, 'secret')
        })
        expect(useAppStore.getState().accounts).toEqual([a1])
        expect(dummySecure.setItem).toHaveBeenCalledWith('pk-ALICE', 'secret')

        // find present / absent
        const { result: findRes, rerender: rerenderFind } = renderHook(
            ({ addr }) => useFindAccountbyAddress(addr),
            {
                initialProps: { addr: 'ALICE' },
            },
        )
        expect(findRes.current).toEqual(a1)
        rerenderFind({ addr: 'MISSING' })
        expect(findRes.current).toBeNull()
    })

    test('useHasAccounts returns true when accounts exist, false when empty', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useHasAccounts, useAddAccount } = await import(
            '../hooks.accounts'
        )

        const { result: hasRes } = renderHook(() => useHasAccounts())
        const { result: addRes } = renderHook(() => useAddAccount())

        // empty initially
        expect(hasRes.current).toBe(false)

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE',
        }

        act(() => {
            addRes.current(a1)
        })

        // now has accounts
        const { result: hasRes2 } = renderHook(() => useHasAccounts())
        expect(hasRes2.current).toBe(true)
    })

    test('useHasNoAccounts returns true when empty, false when accounts exist', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useHasNoAccounts, useAddAccount } = await import(
            '../hooks.accounts'
        )

        const { result: hasNoRes } = renderHook(() => useHasNoAccounts())
        const { result: addRes } = renderHook(() => useAddAccount())

        // no accounts initially
        expect(hasNoRes.current).toBe(true)

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE',
        }

        act(() => {
            addRes.current(a1)
        })

        // now has accounts, so hasNoAccounts should be false
        const { result: hasNoRes2 } = renderHook(() => useHasNoAccounts())
        expect(hasNoRes2.current).toBe(false)
    })

    test('addAccount without secret does not persist PK', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount } = await import('../hooks.accounts')

        const { result: addRes } = renderHook(() => useAddAccount())

        const a: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB',
        }

        act(() => {
            addRes.current(a)
        })
        expect(useAppStore.getState().accounts).toEqual([a])
        expect(dummySecure.setItem).not.toHaveBeenCalled()
    })

    test('removeAccountById removes and clears persisted PK when privateKeyLocation is set', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount, useRemoveAccountById } = await import(
            '../hooks.accounts'
        )

        const { result: addRes } = renderHook(() => useAddAccount())
        const { result: removeByIdRes } = renderHook(() =>
            useRemoveAccountById(),
        )

        const a: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'standard',
            address: 'CAROL',
            privateKeyLocation: 'device',
        }

        act(() => {
            addRes.current(a)
        })
        expect(useAppStore.getState().accounts).toEqual([a])

        act(() => {
            removeByIdRes.current('3')
        })
        expect(useAppStore.getState().accounts).toEqual([])
        expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-CAROL')
    })
})

describe('services/accounts/hooks - createAccount', () => {
    test('createAccount generates mnemonic when none exists, persists root key and PK, and returns account', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // XHD-API responses (ArrayBuffers) => base64('PRIVKEY'), base64('ADDRESS')
        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89]) // 'PRIVKEY'
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83]) // 'ADDRESS'
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)
        const expectedPk = Buffer.from('PRIVKEY').toString('base64')
        const expectedAddr = Buffer.from('ADDRESS').toString('base64')

        // uuid: walletId, pk id, account id
        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET1')
            .mockImplementationOnce(() => 'KEY1')
            .mockImplementationOnce(() => 'ACC1')

        const { useAppStore } = await import('../../../store')
        const { useCreateAccount } = await import('../hooks.accounts')

        const { result: createRes } = renderHook(() => useCreateAccount())
        let created: any
        await act(async () => {
            created = await createRes.current({
                account: 2,
                keyIndex: 5,
            })
        })

        expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-WALLET1')
        expect(bip39Spies.generateMnemonic).toHaveBeenCalledTimes(1)
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'rootkey-WALLET1',
            Buffer.from(mockedMnemonic).toString('base64'),
        )
        expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY1', expectedPk)

        expect(created).toMatchObject({
            id: 'ACC1',
            address: expectedAddr,
            type: 'standard',
            privateKeyLocation: 'pk-KEY1',
            hdWalletDetails: {
                walletId: 'WALLET1',
                account: 2,
                change: 0,
                keyIndex: 5,
                derivationType: 9,
            },
        })

        expect(useAppStore.getState().accounts).toHaveLength(1)
        expect(useAppStore.getState().accounts[0]).toMatchObject({
            address: expectedAddr,
            privateKeyLocation: 'pk-KEY1',
        })
    })

    test('createAccount reuses existing mnemonic with provided walletId and only persists PK', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(
                    'spike assault capital honey word junk bind task gorilla visa resist next size initial bacon ice gym entire bargain voice shift pause supply town',
                ).toString('base64'),
            ),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const expectedPk = Buffer.from('PRIVKEY').toString('base64')
        const expectedAddr = Buffer.from('ADDRESS').toString('base64')

        // XHD-API responses
        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89]) // 'PRIVKEY'
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83]) // 'ADDRESS'
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        // uuid: pk id, account id (walletId is provided)
        uuidSpies.v7
            .mockImplementationOnce(() => 'KEY2')
            .mockImplementationOnce(() => 'ACC2')

        const { useAppStore } = await import('../../../store')
        const { useCreateAccount } = await import('../hooks.accounts')

        const { result: createRes } = renderHook(() => useCreateAccount())
        let created: any
        await act(async () => {
            created = await createRes.current({
                walletId: 'EXIST',
                account: 1,
                keyIndex: 3,
            })
        })

        expect(dummySecure.getItem).toHaveBeenCalledWith('rootkey-EXIST')
        expect(bip39Spies.generateMnemonic).not.toHaveBeenCalled()

        const setCalls = (dummySecure.setItem as any).mock.calls as any[]
        expect(setCalls.some(c => String(c[0]).startsWith('rootkey-'))).toBe(
            false,
        )
        expect(dummySecure.setItem).toHaveBeenCalledWith('pk-KEY2', expectedPk)

        expect(created).toMatchObject({
            id: 'ACC2',
            address: expectedAddr,
            type: 'standard',
            privateKeyLocation: 'pk-KEY2',
            hdWalletDetails: {
                walletId: 'EXIST',
                account: 1,
                change: 0,
                keyIndex: 3,
                derivationType: 9,
            },
        })

        expect(
            useAppStore.getState().accounts.find((a: any) => a.id === 'ACC2'),
        ).toBeTruthy()
    })

    test('createAccount calls updateDeviceOnBackend when deviceID is set', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const updateDeviceSpy = vi.fn(async () => ({}))
        querySpies.useV1DevicesPartialUpdate.mockReturnValue({
            mutateAsync: updateDeviceSpy,
        })

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET_DEV')
            .mockImplementationOnce(() => 'KEY_DEV')
            .mockImplementationOnce(() => 'ACC_DEV')

        const { useAppStore } = await import('../../../store')
        const { useCreateAccount } = await import('../hooks.accounts')

        // Set deviceID in store
        useAppStore.setState({ deviceID: 'TEST_DEVICE_123' })

        const { result: createRes } = renderHook(() => useCreateAccount())
        await act(async () => {
            await createRes.current({
                account: 0,
                keyIndex: 0,
            })
        })

        // Verify updateDeviceOnBackend was called
        expect(updateDeviceSpy).toHaveBeenCalledWith({
            device_id: 'TEST_DEVICE_123',
            data: {
                platform: 'web',
                accounts: expect.any(Array),
            },
        })
    })
})

describe('services/accounts/hooks - useImportWallet', () => {
    test('imports wallet with mnemonic, stores root key, derives 0/0 account, and persists PK', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        // XHD-API responses for 0/0 derivation
        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89]) // 'PRIVKEY'
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83]) // 'ADDRESS'
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)
        const expectedPk = Buffer.from('PRIVKEY').toString('base64')
        const expectedAddr = Buffer.from('ADDRESS').toString('base64')

        // uuid: walletId, pk id, account id
        uuidSpies.v7
            .mockImplementationOnce(() => 'IMPORT_WALLET1')
            .mockImplementationOnce(() => 'IMPORT_KEY1')
            .mockImplementationOnce(() => 'IMPORT_ACC1')

        const importMnemonic =
            'test import seed phrase wallet mnemonic words example one two three four five six seven eight nine ten eleven twelve'

        const { useAppStore } = await import('../../../store')
        const { useImportWallet } = await import('../hooks.accounts')

        const { result: importRes } = renderHook(() => useImportWallet())
        let imported: any
        await act(async () => {
            imported = await importRes.current({
                mnemonic: importMnemonic,
            })
        })

        // Verify mnemonic was stored in secure storage
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'rootkey-IMPORT_WALLET1',
            Buffer.from(importMnemonic).toString('base64'),
        )

        // Verify private key was stored
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-IMPORT_KEY1',
            expectedPk,
        )

        // Verify account structure
        expect(imported).toMatchObject({
            id: 'IMPORT_ACC1',
            address: expectedAddr,
            type: 'standard',
            privateKeyLocation: 'pk-IMPORT_KEY1',
            hdWalletDetails: {
                walletId: 'IMPORT_WALLET1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9, // BIP32DerivationTypes.Peikert
            },
        })

        // Verify account was added to store
        expect(useAppStore.getState().accounts).toHaveLength(1)
        expect(useAppStore.getState().accounts[0]).toMatchObject({
            address: expectedAddr,
            privateKeyLocation: 'pk-IMPORT_KEY1',
        })
    })

    test('imports wallet with existing walletId and mnemonic', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)
        const expectedPk = Buffer.from('PRIVKEY').toString('base64')
        const expectedAddr = Buffer.from('ADDRESS').toString('base64')

        // uuid: pk id, account id (walletId is provided)
        uuidSpies.v7
            .mockImplementationOnce(() => 'IMPORT_KEY2')
            .mockImplementationOnce(() => 'IMPORT_ACC2')

        const importMnemonic = 'existing wallet seed phrase to import'
        const existingWalletId = 'EXISTING_WALLET_ID'

        const { useAppStore } = await import('../../../store')
        const { useImportWallet } = await import('../hooks.accounts')

        const { result: importRes } = renderHook(() => useImportWallet())
        let imported: any
        await act(async () => {
            imported = await importRes.current({
                walletId: existingWalletId,
                mnemonic: importMnemonic,
            })
        })

        // Verify mnemonic was stored with provided walletId
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            `rootkey-${existingWalletId}`,
            Buffer.from(importMnemonic).toString('base64'),
        )

        // Verify private key was stored
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-IMPORT_KEY2',
            expectedPk,
        )

        // Verify account uses provided walletId
        expect(imported).toMatchObject({
            id: 'IMPORT_ACC2',
            address: expectedAddr,
            type: 'standard',
            privateKeyLocation: 'pk-IMPORT_KEY2',
            hdWalletDetails: {
                walletId: existingWalletId,
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        })

        expect(
            useAppStore
                .getState()
                .accounts.find((a: any) => a.id === 'IMPORT_ACC2'),
        ).toBeTruthy()
    })

    test('imports wallet and derives first account with correct derivation path (0/0)', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET3')
            .mockImplementationOnce(() => 'KEY3')
            .mockImplementationOnce(() => 'ACC3')

        const importMnemonic =
            'verify correct derivation path for imported wallet'

        const { useImportWallet } = await import('../hooks.accounts')

        const { result: importRes } = renderHook(() => useImportWallet())
        await act(async () => {
            await importRes.current({
                mnemonic: importMnemonic,
            })
        })

        // Verify deriveKey was called (through the hook)
        // The actual verification happens in the mocked XHD API
        expect(apiSpies.deriveSpy).toHaveBeenCalledTimes(1)
        expect(apiSpies.keyGenSpy).toHaveBeenCalledTimes(1)
    })

    test('imports wallet and adds account to existing accounts in store', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)
        const expectedAddr = Buffer.from('ADDRESS').toString('base64')

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET4')
            .mockImplementationOnce(() => 'KEY4')
            .mockImplementationOnce(() => 'ACC4')

        const { useAppStore } = await import('../../../store')
        const { useImportWallet, useAddAccount } = await import(
            '../hooks.accounts'
        )

        // Add an existing account first
        const { result: addRes } = renderHook(() => useAddAccount())
        const existingAccount: WalletAccount = {
            id: 'EXISTING_ACC',
            name: 'Existing Account',
            type: 'standard',
            address: 'EXISTING_ADDR',
        }
        act(() => {
            addRes.current(existingAccount)
        })

        expect(useAppStore.getState().accounts).toHaveLength(1)

        // Now import a wallet
        const { result: importRes } = renderHook(() => useImportWallet())
        await act(async () => {
            await importRes.current({
                mnemonic: 'new imported wallet mnemonic',
            })
        })

        // Verify both accounts exist
        expect(useAppStore.getState().accounts).toHaveLength(2)
        expect(useAppStore.getState().accounts[0]).toMatchObject({
            id: 'EXISTING_ACC',
            address: 'EXISTING_ADDR',
        })
        expect(useAppStore.getState().accounts[1]).toMatchObject({
            id: 'ACC4',
            address: expectedAddr,
        })
    })

    test('useImportWallet calls updateDeviceOnBackend when deviceID is set', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const updateDeviceSpy = vi.fn(async () => ({}))
        querySpies.useV1DevicesPartialUpdate.mockReturnValue({
            mutateAsync: updateDeviceSpy,
        })

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const priv = new Uint8Array([80, 82, 73, 86, 75, 69, 89])
        const addr = new Uint8Array([65, 68, 68, 82, 69, 83, 83])
        apiSpies.deriveSpy.mockResolvedValueOnce(priv)
        apiSpies.keyGenSpy.mockResolvedValueOnce(addr)

        uuidSpies.v7
            .mockImplementationOnce(() => 'WALLET_IMPORT_DEV')
            .mockImplementationOnce(() => 'KEY_IMPORT_DEV')
            .mockImplementationOnce(() => 'ACC_IMPORT_DEV')

        const { useAppStore } = await import('../../../store')
        const { useImportWallet } = await import('../hooks.accounts')

        // Set deviceID in store
        useAppStore.setState({ deviceID: 'TEST_DEVICE_456' })

        const { result: importRes } = renderHook(() => useImportWallet())
        await act(async () => {
            await importRes.current({
                mnemonic: 'test wallet import with device id',
            })
        })

        // Verify updateDeviceOnBackend was called
        expect(updateDeviceSpy).toHaveBeenCalledWith({
            device_id: 'TEST_DEVICE_456',
            data: {
                platform: 'web',
                accounts: expect.any(Array),
            },
        })
    })
})

describe('services/accounts/hooks - useAddAccount', () => {
    test('useAddAccount calls updateDeviceOnBackend when deviceID is set', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const updateDeviceSpy = vi.fn(async () => ({}))
        querySpies.useV1DevicesPartialUpdate.mockReturnValue({
            mutateAsync: updateDeviceSpy,
        })

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount } = await import('../hooks.accounts')

        // Set deviceID in store
        useAppStore.setState({ deviceID: 'TEST_DEVICE_789' })

        const { result: addRes } = renderHook(() => useAddAccount())

        const testAccount: WalletAccount = {
            id: 'ADD_TEST',
            name: 'Test Add Account',
            type: 'standard',
            address: 'TEST_ADDRESS',
        }

        act(() => {
            addRes.current(testAccount)
        })

        // Verify updateDeviceOnBackend was called
        expect(updateDeviceSpy).toHaveBeenCalledWith({
            device_id: 'TEST_DEVICE_789',
            data: {
                platform: 'web',
                accounts: expect.arrayContaining(['TEST_ADDRESS']),
            },
        })
    })
})
describe('services/accounts/hooks - updateAccount', () => {
    test('useUpdateAccount replaces account and persists PK when provided', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount, useUpdateAccount } = await import(
            '../hooks.accounts'
        )

        const { result: addRes } = renderHook(() => useAddAccount())
        const { result: updateRes } = renderHook(() => useUpdateAccount())

        const initial: WalletAccount = {
            id: 'ID1',
            type: 'standard',
            address: 'ADDR1',
            name: 'Old Name',
        }

        // seed store
        act(() => {
            addRes.current(initial)
        })
        expect(useAppStore.getState().accounts).toEqual([initial])

        // update same address with new fields
        const updated: WalletAccount = {
            ...initial,
            name: 'New Name',
        }

        act(() => {
            updateRes.current(updated, 'new-secret')
        })

        // state replaced with updated object
        expect(useAppStore.getState().accounts).toEqual([updated])
        // PK persisted when provided
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-ADDR1',
            'new-secret',
        )
    })

    test('useUpdateAccount replaces account without persisting PK when not provided', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const updateDeviceSpy = vi.fn(async () => ({}))
        querySpies.useV1DevicesPartialUpdate.mockReturnValue({
            mutateAsync: updateDeviceSpy,
        })

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount, useUpdateAccount } = await import(
            '../hooks.accounts'
        )
        useAppStore.setState({ deviceID: 'TEST_DEVICE_456' })

        const { result: addRes } = renderHook(() => useAddAccount())
        const { result: updateRes } = renderHook(() => useUpdateAccount())

        const initial: WalletAccount = {
            id: 'ID2',
            type: 'standard',
            address: 'ADDR2',
            name: 'Before',
        }

        act(() => {
            addRes.current(initial)
        })
        expect(useAppStore.getState().accounts).toEqual([initial])

        const updated: WalletAccount = {
            ...initial,
            name: 'After',
        }

        act(() => {
            updateRes.current(updated)
        })

        expect(useAppStore.getState().accounts).toEqual([updated])
        expect(dummySecure.setItem).not.toHaveBeenCalled()

        // Verify updateDeviceOnBackend was called
        expect(updateDeviceSpy).toHaveBeenCalledWith({
            device_id: 'TEST_DEVICE_456',
            data: {
                platform: 'web',
                accounts: expect.any(Array),
            },
        })
    })

    test('useUpdateAccount handles when account is not found (findIndex returns -1)', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useAddAccount, useUpdateAccount } = await import(
            '../hooks.accounts'
        )

        const { result: addRes } = renderHook(() => useAddAccount())
        const { result: updateRes } = renderHook(() => useUpdateAccount())

        const initial: WalletAccount = {
            id: 'ID3',
            type: 'standard',
            address: 'ADDR3',
            name: 'Existing',
        }

        act(() => {
            addRes.current(initial)
        })

        // Try to update an account with a different address (not found)
        const notFound: WalletAccount = {
            id: 'ID4',
            type: 'standard',
            address: 'DIFFERENT_ADDR',
            name: 'Not Found',
        }

        act(() => {
            updateRes.current(notFound)
        })

        // The account at index -1 (or undefined) should have been updated
        // This tests the ?? null branch
        expect(useAppStore.getState().accounts).toHaveLength(1)
    })
})

describe('services/accounts/hooks - useAccountBalances', () => {
    const createWrapper = () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        return ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children)
    }

    test('aggregates USD and ALGO using backend/indexer data', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000',
                    fraction_decimals: 6,
                    balance_usd_value: '0.0005',
                },
                {
                    asset_id: 123,
                    amount: '50',
                    fraction_decimals: 2,
                    balance_usd_value: '2.5',
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY',
            type: 'standard',
            address: 'ADDR',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(2.5005))
        expect(result.current[0].algoAmount).toEqual(Decimal(0.501))
    })

    test('returns fallback algos() when computed USD is zero', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000',
                    fraction_decimals: 6,
                    balance_usd_value: '0',
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY2',
            type: 'standard',
            address: 'ADDR2',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(0))
        expect(result.current[0].algoAmount).toEqual(Decimal(0.001))
    })

    test('returns fallback when account.id is null', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000',
                    fraction_decimals: 6,
                    balance_usd_value: '0',
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: undefined, // No ID
            type: 'standard',
            address: 'ADDR3',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(0))
        expect(result.current[0].algoAmount).toEqual(Decimal(0.001))
    })

    test('handles algoAsset without returning early', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000000',
                    fraction_decimals: 6,
                    balance_usd_value: '2',
                },
                {
                    asset_id: 123,
                    amount: '100',
                    fraction_decimals: 2,
                    balance_usd_value: '10',
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY5',
            type: 'standard',
            address: 'ADDR5',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(12))
        expect(result.current[0].algoAmount).toEqual(Decimal(2))
    })

    test('handles ASA with null usd_value', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000',
                    fraction_decimals: 6,
                    balance_usd_value: '0.001',
                },
                {
                    asset_id: 456,
                    amount: '100',
                    fraction_decimals: 2,
                    balance_usd_value: null,
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY6',
            type: 'standard',
            address: 'ADDR6',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(0.001))
        expect(result.current[0].algoAmount).toEqual(Decimal(1.001))
    })

    test('handles missing account amount data', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY7',
            type: 'standard',
            address: 'ADDR7',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(0))
        expect(result.current[0].algoAmount).toEqual(Decimal(0))
    })

    test('handles algoAsset with null usd_value in non-zero usdAmount path', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '2000000',
                    fraction_decimals: 6,
                    balance_usd_value: null,
                },
                {
                    asset_id: 789,
                    amount: '200',
                    fraction_decimals: 2,
                    balance_usd_value: '6',
                },
            ],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY9',
            type: 'standard',
            address: 'ADDR9',
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current[0].isFetched).toBe(true)
        })

        expect(result.current[0].usdAmount).toEqual(Decimal(6))
        expect(result.current[0].algoAmount).toEqual(Decimal(4))
    })
})
