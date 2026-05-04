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
import { useRemoveAccountById } from '../useRemoveAccountById'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const deleteKeySpy = vi.fn()
const keyStoreRemoveSpy = vi.fn()
vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        deleteKey: deleteKeySpy,
        keyStore: {
            remove: keyStoreRemoveSpy,
        },
    }),
}))

describe('useRemoveAccountById', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('removeAccountById deletes the algo25 root key and seed keystore entry when no sibling references it', async () => {
        const a: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE',
            keyPairId: 'kp-alice',
        }
        useAccountsStore.setState({ accounts: [a] })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('kp-alice')
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('kp-alice-seed')
    })

    test('removeAccountById deletes the HD root key and entropy keystore entry when no sibling references it', async () => {
        const a: WalletAccount = {
            id: '1',
            name: 'Bob',
            type: 'hdWallet',
            address: 'BOB',
            keyPairId: 'hd-1',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }
        useAccountsStore.setState({ accounts: [a] })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1')
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('hd-1-entropy')
    })

    test('removeAccountById preserves the entropy keystore entry when a sibling HD account still references the same root', async () => {
        const accounts: WalletAccount[] = [
            {
                id: '1',
                name: 'HD-1',
                type: 'hdWallet',
                address: 'ADDR1',
                keyPairId: 'hd-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
            {
                id: '2',
                name: 'HD-2',
                type: 'hdWallet',
                address: 'ADDR2',
                keyPairId: 'hd-1',
                hdWalletDetails: {
                    account: 1,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1')
        expect(keyStoreRemoveSpy).not.toHaveBeenCalled()
    })

    test('removeAccountById deletes the entropy keystore entry when the last HD account on the root is removed', async () => {
        const accounts: WalletAccount[] = [
            {
                id: '1',
                name: 'HD-1',
                type: 'hdWallet',
                address: 'ADDR1',
                keyPairId: 'hd-1',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1')
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('hd-1-entropy')
    })

    test('removeAccountById preserves the seed keystore entry when a sibling algo25 account still references the same root', async () => {
        const accounts: WalletAccount[] = [
            {
                id: '1',
                name: 'A25-1',
                type: 'algo25',
                address: 'ADDR1',
                keyPairId: 'kp-shared',
            },
            {
                id: '2',
                name: 'A25-2',
                type: 'algo25',
                address: 'ADDR2',
                keyPairId: 'kp-shared',
            },
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(deleteKeySpy).toHaveBeenCalledWith('kp-shared')
        expect(keyStoreRemoveSpy).not.toHaveBeenCalled()
    })
})
