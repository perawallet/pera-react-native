/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useRemoveAccount } from '../useRemoveAccount'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import { cleanupRemovedAccountData } from '../../cleanup'
import { logger } from '@perawallet/wallet-core-shared'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
} from '../../__tests__/accountFactory'

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
    return renderHook(() => useRemoveAccount(), { wrapper })
}

const ledgerAccount = (address: string, accountIndex: number): WalletAccount =>
    testAccount('hardware', address, {
        id: address,
        custody: { ...TEST_CUSTODY.hardware, accountIndex },
    })

const hdAccount = (
    id: string,
    address: string,
    keyPairId: string,
    account = 0,
): WalletAccount =>
    buildTestAccount(
        {
            kind: 'local',
            seed: TEST_CUSTODY.hd.seed,
            hd: { account, keyIndex: 0 },
        },
        { algorand: { address, keyPairId } },
        { id },
    )

const ids = () => useAccountsStore.getState().accounts.map(a => a.id)

describe('useRemoveAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        parentMap.clear()
    })

    test('removes a hardware account by id and keeps siblings from the same device', async () => {
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

        expect(ids()).toEqual(['LEDGER1', 'LEDGER3'])
        // Hardware accounts hold no local key material.
        expect(deleteKeySpy).not.toHaveBeenCalled()
        expect(removeKeyAndChildrenSpy).not.toHaveBeenCalled()
    })

    test('removes the child key and sweeps the seed when no other account references it', async () => {
        parentMap.set('kp-alice-ed25519', 'kp-alice')
        const a = buildTestAccount(
            TEST_CUSTODY.local,
            { algorand: { address: 'ALICE', keyPairId: 'kp-alice-ed25519' } },
            { id: '1', name: 'Alice' },
        )
        useAccountsStore.setState({ accounts: [a] })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('kp-alice-ed25519')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('kp-alice')
    })

    test('removes the child + sweeps the seed for an HD account when no sibling remains', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        useAccountsStore.setState({
            accounts: [hdAccount('1', 'BOB', 'hd-1-acc0-idx0-dt9')],
        })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('hd-1')
    })

    test('only removes the child (not the seed) when a sibling HD account still references the same seed', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        parentMap.set('hd-1-acc1-idx0-dt9', 'hd-1')
        useAccountsStore.setState({
            accounts: [
                hdAccount('1', 'ADDR1', 'hd-1-acc0-idx0-dt9', 0),
                hdAccount('2', 'ADDR2', 'hd-1-acc1-idx0-dt9', 1),
            ],
        })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('1')
        })

        expect(ids()).toEqual(['2'])
        // The leaving account's child entry is removed, but the shared
        // seed (and the sibling's child) stays put.
        expect(deleteKeySpy).toHaveBeenCalledWith('hd-1-acc0-idx0-dt9')
        expect(removeKeyAndChildrenSpy).not.toHaveBeenCalled()
    })

    test('sweeps the seed when the last HD account on it is removed', async () => {
        parentMap.set('hd-1-acc0-idx0-dt9', 'hd-1')
        useAccountsStore.setState({
            accounts: [hdAccount('1', 'ADDR1', 'hd-1-acc0-idx0-dt9')],
        })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('1')
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
            matches([
                'accounts',
                'owned-asset-ids',
                { scope: scopeForLegacyNetwork('mainnet') },
            ]),
        ).toBe(true)
        expect(
            matches([
                'assets',
                { assetIDs: [], scope: scopeForLegacyNetwork('mainnet') },
            ]),
        ).toBe(true)

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
                {
                    address: 'LEDGER2',
                    scope: scopeForLegacyNetwork('mainnet'),
                },
            ]),
        ).toBe(true)
        expect(
            matches([
                'accounts',
                'balance',
                {
                    address: 'LEDGER1',
                    scope: scopeForLegacyNetwork('mainnet'),
                },
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
        expect(ids()).toEqual(['LEDGER1'])

        errorSpy.mockRestore()
    })

    test('removes the keys and cleans up the address the account holds on every chain', async () => {
        parentMap.set('k-fake', 'seed-1')
        parentMap.set('k-eth', 'seed-1')
        const spanning = buildTestAccount(
            TEST_CUSTODY.local,
            {
                algorand: { address: 'FAKE-ADDR', keyPairId: 'k-fake' },
                ethereum: { address: '0xADDR', keyPairId: 'k-eth' },
            },
            { id: 'spanning' },
        )
        useAccountsStore.setState({ accounts: [spanning] })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('spanning')
        })

        expect(deleteKeySpy).toHaveBeenCalledWith('k-fake')
        expect(deleteKeySpy).toHaveBeenCalledWith('k-eth')
        expect(removeKeyAndChildrenSpy).toHaveBeenCalledWith('seed-1')
        await waitFor(() =>
            expect(cleanupRemovedAccountData).toHaveBeenCalledTimes(2),
        )
        expect(cleanupRemovedAccountData).toHaveBeenCalledWith({
            accountAddress: 'FAKE-ADDR',
        })
        expect(cleanupRemovedAccountData).toHaveBeenCalledWith({
            accountAddress: '0xADDR',
        })
    })

    test('leaves the wallet as it is for an unknown id', async () => {
        useAccountsStore.setState({ accounts: [ledgerAccount('LEDGER1', 0)] })

        const { result } = renderWithClient()

        await act(async () => {
            await result.current('missing')
        })

        expect(ids()).toEqual(['LEDGER1'])
        expect(deleteKeySpy).not.toHaveBeenCalled()
    })
})
