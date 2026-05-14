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

const keyStoreRemoveSpy = vi.fn()
const removeKeyAndChildrenSpy = vi.fn()
// child id → seed id mapping shared between tests; reset in beforeEach.
const parentMap: Map<string, string> = new Map()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        keyStore: {
            remove: keyStoreRemoveSpy,
        },
        seedIdOf: (childId?: string) =>
            childId ? parentMap.get(childId) : undefined,
        removeKeyAndChildren: removeKeyAndChildrenSpy,
    }),
}))

describe('useRemoveAccountById', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        parentMap.clear()
    })

    test('removes the child key and sweeps the seed when no other account references it', async () => {
        parentMap.set('kp-alice-ed25519', 'kp-alice')
        const a: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE',
            keyPairId: 'kp-alice-ed25519',
        }
        useAccountsStore.setState({ accounts: [a] })

        const { result } = renderHook(() => useRemoveAccountById())

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('kp-alice-ed25519')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('kp-alice')
    })

    test('removes the child + sweeps the seed for an HD account when no sibling remains', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        const a: WalletAccount = {
            id: '1',
            name: 'Bob',
            type: 'hdWallet',
            address: 'BOB',
            keyPairId: 'hd-1-acc0-idx0-dt9',
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
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('hd-1')
    })

    test('only removes the child (not the seed) when a sibling HD account still references the same seed', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        parentMap.set('hd-1-acc1-idx0-dt9', 'hd-1')
        const accounts: WalletAccount[] = [
            {
                id: '1',
                name: 'HD-1',
                type: 'hdWallet',
                address: 'ADDR1',
                keyPairId: 'hd-1-acc0-idx0-dt9',
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
                keyPairId: 'hd-1-acc1-idx0-dt9',
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
        // The leaving account's child entry is removed, but the shared
        // seed (and the sibling's child) stays put.
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).not.toHaveBeenCalled()
    })

    test('sweeps the seed when the last HD account on it is removed', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        const accounts: WalletAccount[] = [
            {
                id: '1',
                name: 'HD-1',
                type: 'hdWallet',
                address: 'ADDR1',
                keyPairId: 'hd-1-acc0-idx0-dt9',
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
        expect(keyStoreRemoveSpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('hd-1')
    })
})
