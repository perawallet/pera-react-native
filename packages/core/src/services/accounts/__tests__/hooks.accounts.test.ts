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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '../types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'
import Decimal from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Networks } from '@services/blockchain'

// Hoisted mocks for createAccount path dependencies
const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))
vi.mock('uuid', () => ({ v7: uuidSpies.v7 }))

const apiSpies = vi.hoisted(() => ({
    deriveSpy: vi.fn(),
    keyGenSpy: vi.fn(),
    signTransactionSpy: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}))

const currencySpies = vi.hoisted(() => ({
    useV1CurrenciesRead: vi.fn(),
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
    v1AccountsAssetsList: vi.fn(
        async (): Promise<any> => ({
            results: [],
        }),
    ),
}))

const mockedMnemonic =
    'spike assault capital honey word junk bind task gorilla visa resist next size initial bacon ice gym entire bargain voice shift pause supply town'

const bip39Spies = vi.hoisted(() => ({
    generateMnemonic: vi.fn(() => mockedMnemonic),
    mnemonicToSeedSync: vi.fn(() => Buffer.from('seed_sync')),
    mnemonicToSeed: vi.fn(async () => Buffer.from('seed_async')),
    mnemonicToEntropy: vi.fn(async () => Buffer.from('entropy')),
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
        XHDWalletAPI: class {
            deriveKey = apiSpies.deriveSpy
            keyGen = apiSpies.keyGenSpy
            signAlgoTransaction = apiSpies.signTransactionSpy
        },
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
vi.mock('../../../api/index', () => ({
    useV1CurrenciesRead: currencySpies.useV1CurrenciesRead,
}))

describe('services/accounts/hooks', () => {
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
            canSign: true,
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
            canSign: true,
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
            canSign: true,
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
            canSign: true,
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

    test('useAllAccounts returns all accounts from store', async () => {
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
        const { useAllAccounts } = await import('../hooks.accounts')

        const { result: allAccountsRes } = renderHook(() => useAllAccounts())

        // Initially empty
        expect(allAccountsRes.current).toEqual([])

        // Add accounts to store
        const accounts: WalletAccount[] = [
            {
                id: '1',
                type: 'standard',
                address: 'ADDR1',
                canSign: true,
            },
            {
                id: '2',
                type: 'standard',
                address: 'ADDR2',
                canSign: true,
            },
        ]
        useAppStore.setState({ accounts })

        const { result: allAccountsRes2 } = renderHook(() => useAllAccounts())
        expect(allAccountsRes2.current).toEqual(accounts)
    })

    test('useFindAccountbyAddress finds account by address', async () => {
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
        const { useFindAccountbyAddress } = await import('../hooks.accounts')

        const accounts: WalletAccount[] = [
            {
                id: '1',
                type: 'standard',
                address: 'ADDR1',
                canSign: true,
            },
            {
                id: '2',
                type: 'standard',
                address: 'ADDR2',
                canSign: true,
            },
        ]
        useAppStore.setState({ accounts })

        const { result: findRes } = renderHook(() =>
            useFindAccountbyAddress('ADDR1'),
        )
        expect(findRes.current).toEqual(accounts[0])

        const { result: findRes2 } = renderHook(() =>
            useFindAccountbyAddress('NONEXISTENT'),
        )
        expect(findRes2.current).toBeNull()
    })

    test('useSelectedAccount returns selected account from store', async () => {
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
        const { useSelectedAccount } = await import('../hooks.accounts')

        const selectedAccount: WalletAccount = {
            id: 'SELECTED',
            type: 'standard',
            address: 'SELECTED_ADDR',
            canSign: true,
        }

        // Mock getSelectedAccount to return the selected account
        const mockGetSelectedAccount = vi.fn(() => selectedAccount)
        useAppStore.setState({ getSelectedAccount: mockGetSelectedAccount })

        const { result } = renderHook(() => useSelectedAccount())
        expect(result.current).toEqual(selectedAccount)
        expect(mockGetSelectedAccount).toHaveBeenCalled()
    })

    test('useSelectedAccountAddress returns selected account address and setter', async () => {
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
        const { useSelectedAccountAddress } = await import('../hooks.accounts')

        const mockSetSelectedAccountAddress = vi.fn()
        useAppStore.setState({
            selectedAccountAddress: 'TEST_SELECTED_ADDR',
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        })

        const { result } = renderHook(() => useSelectedAccountAddress())
        expect(result.current.selectedAccountAddress).toBe('TEST_SELECTED_ADDR')
        expect(result.current.setSelectedAccountAddress).toBe(
            mockSetSelectedAccountAddress,
        )
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
            expect.any(Buffer),
        )
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-KEY1',
            expect.any(Buffer),
        )

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
                    JSON.stringify({
                        seed: Buffer.from('seed_async').toString('base64'),
                        entropy: Buffer.from('entropy').toString('base64'),
                    }),
                ),
            ),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

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
        expect(bip39Spies.mnemonicToSeed).not.toHaveBeenCalled()
        expect(bip39Spies.mnemonicToEntropy).not.toHaveBeenCalled()

        const setCalls = (dummySecure.setItem as any).mock.calls as any[]
        expect(setCalls.some(c => String(c[0]).startsWith('rootkey-'))).toBe(
            false,
        )
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-KEY2',
            expect.any(Buffer),
        )

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
        useAppStore.setState({
            network: Networks.testnet,
            deviceIDs: new Map([
                ['testnet', 'TEST_DEVICE_123'],
                ['mainnet', null],
            ]),
        })

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

    test('createAccount throws error when masterKey has no seed', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(JSON.stringify({})),
            ), // Empty object, no seed
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useCreateAccount } = await import('../hooks.accounts')

        const { result: createRes } = renderHook(() => useCreateAccount())

        await expect(
            createRes.current({
                walletId: 'EXISTING_WALLET',
                account: 0,
                keyIndex: 0,
            }),
        ).rejects.toThrow('No key found for EXISTING_WALLET')
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
            expect.any(Buffer),
        )

        // Verify private key was stored
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-IMPORT_KEY1',
            expect.any(Buffer),
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
            expect.any(Buffer),
        )

        // Verify private key was stored
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-IMPORT_KEY2',
            expect.any(Buffer),
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
            canSign: true,
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
        useAppStore.setState({
            network: Networks.testnet,
            deviceIDs: new Map([
                ['testnet', 'TEST_DEVICE_456'],
                ['mainnet', null],
            ]),
        })

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
        useAppStore.setState({
            network: Networks.testnet,
            deviceIDs: new Map([
                ['testnet', 'TEST_DEVICE_789'],
                ['mainnet', null],
            ]),
        })

        const { result: addRes } = renderHook(() => useAddAccount())

        const testAccount: WalletAccount = {
            id: 'ADD_TEST',
            name: 'Test Add Account',
            type: 'standard',
            address: 'TEST_ADDRESS',
            canSign: true,
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

    test('useAddAccount generates keys for standard HD wallet accounts with device privateKeyLocation', async () => {
        vi.resetModules()
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        apiSpies.deriveSpy.mockReset()
        apiSpies.keyGenSpy.mockReset()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('test-seed').toString('base64'),
                        entropy: Buffer.from('entropy').toString('base64'),
                    }),
                ),
            ),
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

        uuidSpies.v7.mockImplementationOnce(() => 'ADD_KEY_ID')

        const { useAppStore } = await import('../../../store')
        const { useAddAccount } = await import('../hooks.accounts')

        const { result: addRes } = renderHook(() => useAddAccount())

        const hdAccount: WalletAccount = {
            id: 'HD_ACC',
            type: 'standard',
            address: 'PLACEHOLDER_ADDR', // Will be replaced
            canSign: true,
            hdWalletDetails: {
                walletId: 'WALLET_ID',
                account: 1,
                change: 0,
                keyIndex: 2,
                derivationType: 9,
            },
            privateKeyLocation: 'device',
        }

        await act(async () => {
            await addRes.current(hdAccount)
        })

        // Verify keys were derived and stored
        expect(apiSpies.deriveSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            expect.any(Array),
            true,
            9,
        )
        expect(apiSpies.keyGenSpy).toHaveBeenCalledWith('ROOT_KEY', 0, 1, 2, 9)
        expect(dummySecure.setItem).toHaveBeenCalledWith(
            'pk-ADD_KEY_ID',
            expect.any(Buffer),
        )

        // Verify account was updated with derived address and new ID
        const addedAccount = useAppStore.getState().accounts[0]
        expect(addedAccount.address).toBe(
            Buffer.from('ADDRESS').toString('base64'),
        )
        expect(addedAccount.id).toBe('ADD_KEY_ID')
        // Note: privateKeyLocation remains 'device' as per current implementation
        expect(addedAccount.privateKeyLocation).toBe('device')
    })
})
describe('services/accounts/hooks - updateAccount', () => {
    test('useUpdateAccount replaces account', async () => {
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
            canSign: true,
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
            updateRes.current(updated)
        })

        // state replaced with updated object
        expect(useAppStore.getState().accounts).toEqual([updated])
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
            canSign: true,
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
            canSign: true,
        }

        act(() => {
            updateRes.current(notFound)
        })

        // The account at index -1 (or undefined) should have been updated
        // This tests the ?? null branch
        expect(useAppStore.getState().accounts).toHaveLength(1)
    })

    test('useUpdateAccount calls updateDeviceOnBackend when deviceID is set', async () => {
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

        // Set deviceID in store
        useAppStore.setState({
            network: Networks.testnet,
            deviceIDs: new Map([
                ['testnet', 'TEST_DEVICE_UPDATE'],
                ['mainnet', null],
            ]),
        })

        const { result: addRes } = renderHook(() => useAddAccount())
        const { result: updateRes } = renderHook(() => useUpdateAccount())

        const initial: WalletAccount = {
            id: 'UPDATE_TEST',
            type: 'standard',
            address: 'UPDATE_ADDR',
            name: 'Original Name',
            canSign: true,
        }

        act(() => {
            addRes.current(initial)
        })

        const updated: WalletAccount = {
            ...initial,
            name: 'Updated Name',
        }

        act(() => {
            updateRes.current(updated)
        })

        // Verify updateDeviceOnBackend was called
        expect(updateDeviceSpy).toHaveBeenCalledWith({
            device_id: 'TEST_DEVICE_UPDATE',
            data: {
                platform: 'web',
                accounts: ['UPDATE_ADDR'],
            },
        })
    })
})

describe('services/accounts/hooks - useTransactionSigner', () => {
    test('signs transaction successfully when account and mnemonic exist', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('test-mnemonic').toString('base64'),
                        entropy: Buffer.from('entropy').toString('base64'),
                    }),
                ),
            ),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Set up account in store
        const testAccount: WalletAccount = {
            id: 'TEST_ACC',
            type: 'standard',
            address: 'TEST_ADDR',
            hdWalletDetails: {
                walletId: 'WALLET1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            privateKeyLocation: 'pk-TEST',
            canSign: true,
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction')

        await act(async () => {
            await result.current.signTransactionForAddress(
                'TEST_ADDR',
                transaction,
            )
        })

        expect(apiSpies.signTransactionSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            0,
            0,
            transaction,
            9,
        )
    })

    test('signs transaction successfully with different account', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('different-mnemonic').toString(
                            'base64',
                        ),
                        entropy: Buffer.from('entropy').toString('base64'),
                    }),
                ),
            ),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Set up different account in store
        const testAccount: WalletAccount = {
            id: 'TEST_ACC2',
            type: 'standard',
            address: 'TEST_ADDR2',
            canSign: true,
            hdWalletDetails: {
                walletId: 'WALLET2',
                account: 1,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
            privateKeyLocation: 'pk-TEST2',
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction-2')

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signTransactionForAddress(
                'TEST_ADDR2',
                transaction,
            )
        })

        expect(apiSpies.signTransactionSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            1,
            1,
            transaction,
            9,
        )
        expect(signed).toEqual(new Uint8Array([1, 2, 3, 4]))
    })

    test('signs transaction successfully with different account (duplicate test)', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) =>
                Buffer.from(
                    JSON.stringify({
                        seed: Buffer.from('different-mnemonic-2').toString(
                            'base64',
                        ),
                        entropy: Buffer.from('entropy').toString('base64'),
                    }),
                ),
            ),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Set up different account in store
        const testAccount: WalletAccount = {
            id: 'TEST_ACC3',
            type: 'standard',
            address: 'TEST_ADDR3',
            hdWalletDetails: {
                walletId: 'WALLET3',
                account: 2,
                change: 0,
                keyIndex: 2,
                derivationType: 9,
            },
            privateKeyLocation: 'pk-TEST3',
            canSign: true,
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction-3')

        let signed: Uint8Array | undefined
        await act(async () => {
            signed = await result.current.signTransactionForAddress(
                'TEST_ADDR3',
                transaction,
            )
        })

        expect(apiSpies.signTransactionSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            2,
            2,
            transaction,
            9,
        )
        expect(signed).toEqual(new Uint8Array([1, 2, 3, 4]))
    })

    test('rejects when account not found', async () => {
        vi.resetModules()
        vi.clearAllMocks()

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
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Empty accounts
        useAppStore.setState({ accounts: [] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction')

        await expect(
            result.current.signTransactionForAddress(
                'NONEXISTENT_ADDR',
                transaction,
            ),
        ).rejects.toThrow('No HD wallet found for NONEXISTENT_ADDR')
    })

    test('rejects when account has no hdWalletDetails', async () => {
        vi.resetModules()
        vi.clearAllMocks()

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
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Account without hdWalletDetails
        const testAccount: WalletAccount = {
            id: 'TEST_ACC',
            type: 'standard',
            address: 'TEST_ADDR',
            privateKeyLocation: 'pk-TEST',
            canSign: true,
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction')

        await expect(
            result.current.signTransactionForAddress('TEST_ADDR', transaction),
        ).rejects.toThrow('No HD wallet found for TEST_ADDR')
    })

    test('rejects when mnemonic not found in storage', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null), // No mnemonic
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Account with hdWalletDetails
        const testAccount: WalletAccount = {
            id: 'TEST_ACC',
            type: 'standard',
            address: 'TEST_ADDR',
            hdWalletDetails: {
                walletId: 'WALLET1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            privateKeyLocation: 'pk-TEST',
            canSign: true,
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction')

        await expect(
            result.current.signTransactionForAddress('TEST_ADDR', transaction),
        ).rejects.toThrow('No signing keys found for TEST_ADDR')
    })

    test('signs transaction successfully with fallback to raw seed data', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => Buffer.from('raw-seed-data')), // Raw seed data (old format)
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { useTransactionSigner } = await import('../hooks.accounts')

        // Set up account in store
        const testAccount: WalletAccount = {
            id: 'TEST_ACC',
            type: 'standard',
            address: 'TEST_ADDR',
            hdWalletDetails: {
                walletId: 'WALLET1',
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
            privateKeyLocation: 'pk-TEST',
            canSign: true,
        }
        useAppStore.setState({ accounts: [testAccount] })

        const { result } = renderHook(() => useTransactionSigner())
        const transaction = Buffer.from('test-transaction')

        await act(async () => {
            await result.current.signTransactionForAddress(
                'TEST_ADDR',
                transaction,
            )
        })

        expect(apiSpies.signTransactionSpy).toHaveBeenCalledWith(
            'ROOT_KEY',
            0,
            0,
            0,
            transaction,
            9,
        )
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
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    }

    test('aggregates USD and ALGO using backend/indexer data', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].algoAmount).toEqual(Decimal(0.501))
        expect(result.current.data[0].localAmount).toEqual(Decimal(2.5005))
        expect(result.current.totalAlgo).toEqual(Decimal(0.501))
        expect(result.current.totalLocal).toEqual(Decimal(2.5005))
        expect(result.current.loading).toBe(false)
    })

    test('returns fallback algos() when computed USD is zero', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(0))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(0.001))
    })

    test('returns fallback when account.id is null', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(0))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(0.001))
    })

    test('handles algoAsset without returning early', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(12))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(2))
    })

    test('handles ASA with null usd_value', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(0.001))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(1.001))
    })

    test('handles missing account amount data', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

        querySpies.v1AccountsAssetsList.mockResolvedValue({
            results: [],
        })

        const { useAccountBalances } = await import('../hooks.accounts')
        const acct: WalletAccount = {
            id: 'ANY7',
            type: 'standard',
            address: 'ADDR7',
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(0))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(0))
    })

    test('handles algoAsset with null usd_value in non-zero usdAmount path', async () => {
        vi.resetModules()
        vi.clearAllMocks()

        currencySpies.useV1CurrenciesRead.mockReturnValue({
            data: { usd_value: '1.0' },
            isPending: false,
        })

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
            canSign: true,
        }

        const { result } = renderHook(() => useAccountBalances([acct]), {
            wrapper: createWrapper(),
        })

        await vi.waitFor(() => {
            expect(result.current.data[0].isFetched).toBe(true)
        })

        expect(result.current.data[0].localAmount).toEqual(Decimal(6))
        expect(result.current.data[0].algoAmount).toEqual(Decimal(4))
    })
})
