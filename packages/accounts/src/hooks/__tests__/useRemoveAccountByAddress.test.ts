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

import { createElement, type ReactNode } from 'react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRemoveAccountByAddress } from '../useRemoveAccountByAddress'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import { cleanupRemovedAccountData } from '../../cleanup'
import { logger } from '@perawallet/wallet-core-shared'

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
const removeKeyAndChildrenSpy = vi.fn()
// child id → seed id mapping shared between tests; reset in beforeEach.
const parentMap: Map<string, string> = new Map()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        deleteKey: deleteKeySpy,
        seedIdOf: (childId?: string) =>
            childId ? parentMap.get(childId) : undefined,
        removeKeyAndChildren: removeKeyAndChildrenSpy,
    }),
}))

vi.mock('../../cleanup', () => ({
    cleanupRemovedAccountData: vi.fn().mockResolvedValue({
        networksAffected: [],
        prunedAssetIdsByNetwork: {},
    }),
}))

const renderWithClient = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
    return renderHook(() => useRemoveAccountByAddress(), { wrapper })
}

const ledgerAccount = (
    address: string,
    accountIndex: number,
): WalletAccount => ({
    // Hardware accounts imported via the Ledger pairing flow carry no `id`
    // (they are deduped by address) — removal must still work for them.
    type: 'hardware',
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Nano X',
        accountIndex,
        transportType: 'ble',
    },
})

describe('useRemoveAccountByAddress', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        parentMap.clear()
    })

    test('removes an id-less hardware account and keeps siblings from the same device', async () => {
        useAccountsStore.setState({
            accounts: [
                ledgerAccount('LEDGER1', 0),
                ledgerAccount('LEDGER2', 1),
                ledgerAccount('LEDGER3', 2),
            ],
        })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('LEDGER2')
        })

        expect(
            useAccountsStore.getState().accounts.map(a => a.address),
        ).toEqual(['LEDGER1', 'LEDGER3'])
        // Hardware accounts hold no local key material.
        expect(deleteKeySpy).not.toHaveBeenCalled()
        expect(removeKeyAndChildrenSpy).not.toHaveBeenCalled()
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

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('ALICE')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('kp-alice-ed25519')
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

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('BOB')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
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

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('ADDR1')
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        // The leaving account's child entry is removed, but the shared
        // seed (and the sibling's child) stays put.
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
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

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('ADDR1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('hd-1')
    })

    test('fires the cleanup job with the removed address', async () => {
        useAccountsStore.setState({
            accounts: [
                ledgerAccount('LEDGER1', 0),
                ledgerAccount('LEDGER2', 1),
            ],
        })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('LEDGER2')
        })

        expect(cleanupRemovedAccountData).toHaveBeenCalledWith({
            accountAddress: 'LEDGER2',
        })
    })

    test('invalidates account and asset caches after cleanup resolves', async () => {
        useAccountsStore.setState({
            accounts: [
                ledgerAccount('LEDGER1', 0),
                ledgerAccount('LEDGER2', 1),
            ],
        })
        const invalidateSpy = vi.spyOn(
            QueryClient.prototype,
            'invalidateQueries',
        )

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('LEDGER2')
        })

        // The cleanup .then() runs on a microtask after removal resolves.
        await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())

        // Collect the predicates passed to invalidateQueries and confirm one
        // targets 'accounts' queries and one targets 'assets' queries.
        const predicates = invalidateSpy.mock.calls
            .map(
                ([arg]) =>
                    (arg as { predicate?: (q: unknown) => boolean })?.predicate,
            )
            .filter(
                (p): p is (q: unknown) => boolean => typeof p === 'function',
            )

        const matches = (queryKey: unknown[]) =>
            predicates.some(p => p({ queryKey } as never))

        expect(
            matches(['accounts', 'owned-asset-ids', { network: 'mainnet' }]),
        ).toBe(true)
        expect(matches(['assets', { assetIDs: [], network: 'mainnet' }])).toBe(
            true,
        )

        invalidateSpy.mockRestore()
    })

    test('evicts the removed account cached queries after cleanup resolves', async () => {
        useAccountsStore.setState({
            accounts: [
                ledgerAccount('LEDGER1', 0),
                ledgerAccount('LEDGER2', 1),
            ],
        })
        const removeSpy = vi.spyOn(QueryClient.prototype, 'removeQueries')

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('LEDGER2')
        })

        await waitFor(() => expect(removeSpy).toHaveBeenCalled())

        // The eviction predicate targets the removed address only — sibling
        // accounts' cached queries are left untouched.
        const predicates = removeSpy.mock.calls
            .map(
                ([arg]) =>
                    (arg as { predicate?: (q: unknown) => boolean })?.predicate,
            )
            .filter(
                (p): p is (q: unknown) => boolean => typeof p === 'function',
            )
        const matches = (queryKey: unknown[]) =>
            predicates.some(p => p({ queryKey } as never))

        expect(
            matches([
                'accounts',
                'balance',
                { address: 'LEDGER2', network: 'mainnet' },
            ]),
        ).toBe(true)
        expect(
            matches([
                'accounts',
                'balance',
                { address: 'LEDGER1', network: 'mainnet' },
            ]),
        ).toBe(false)

        removeSpy.mockRestore()
    })

    test('does not surface cleanup failures to the removal flow', async () => {
        useAccountsStore.setState({
            accounts: [
                ledgerAccount('LEDGER1', 0),
                ledgerAccount('LEDGER2', 1),
            ],
        })
        vi.mocked(cleanupRemovedAccountData).mockRejectedValueOnce(
            new Error('cleanup boom'),
        )
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderWithClient()

        // Removal itself must resolve even though cleanup rejects.
        await act(async () => {
            await expect(result.current('LEDGER2')).resolves.toBeUndefined()
        })

        await waitFor(() => expect(errorSpy).toHaveBeenCalled())

        // The account was still removed.
        expect(
            useAccountsStore.getState().accounts.map(a => a.address),
        ).toEqual(['LEDGER1'])

        errorSpy.mockRestore()
    })
})
