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

import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useRescanDelegatedAccounts } from '../useRescanDelegatedAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    fakeAccountsChain,
    registerFakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'
import { addressOn, authorityOf } from '../../credentials'

const mocks = {
    get fetchDelegatedAddresses() {
        return vi.mocked(
            fakeAccountsChain().adapter.authority!.fetchDelegatedAddresses,
        )
    },
    get isValidAddress() {
        return vi.mocked(fakeAccountsChain().codec.isValid)
    },
}

const delegation = vi.hoisted(() => ({ isAvailable: true }))
vi.mock('../useIsDelegationAvailable', () => ({
    useIsDelegationAvailable: () => delegation.isAvailable,
}))

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useRescanDelegatedAccounts — scan', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delegation.isAvailable = true
        useAccountsStore.getState().resetState()
    })

    it('classifies discovered addresses into already-imported vs importable', async () => {
        setAccounts([testAccount('local', 'IN_WALLET')])
        mocks.fetchDelegatedAddresses.mockResolvedValue([
            'IN_WALLET',
            'NEW_ONE',
        ])

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const scanResult = await result.current.scan('SOURCE')

        expect(mocks.fetchDelegatedAddresses).toHaveBeenCalledWith(
            'SOURCE',
            MAINNET_SCOPE,
        )
        expect(scanResult).toEqual({
            importedAddresses: ['IN_WALLET'],
            notImportedAddresses: ['NEW_ONE'],
        })
    })

    it('scans nothing while delegation is unavailable', async () => {
        delegation.isAvailable = false

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        expect(await result.current.scan('SOURCE')).toEqual({
            importedAddresses: [],
            notImportedAddresses: [],
        })
        expect(await result.current.scanAll(['SOURCE'])).toEqual({
            importedAddresses: [],
            candidates: [],
            failedSources: [],
        })
        expect(mocks.fetchDelegatedAddresses).not.toHaveBeenCalled()
    })

    it('resolves an empty classification on a chain without delegation', async () => {
        registerFakeAccountsChain({ authority: undefined })

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        await expect(result.current.scan('SOURCE')).resolves.toEqual({
            importedAddresses: [],
            notImportedAddresses: [],
        })
    })

    it('returns empty classification when the indexer reports nothing', async () => {
        mocks.fetchDelegatedAddresses.mockResolvedValue([])

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const scanResult = await result.current.scan('SOURCE')

        expect(scanResult).toEqual({
            importedAddresses: [],
            notImportedAddresses: [],
        })
    })
})

describe('useRescanDelegatedAccounts — scanAll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('fans out one indexer scan per source key and merges classified results', async () => {
        setAccounts([testAccount('local', 'IN_WALLET')])
        mocks.fetchDelegatedAddresses.mockImplementation(
            async (source: string) =>
                source === 'SOURCE_A' ? ['IN_WALLET', 'NEW_A'] : ['NEW_B'],
        )

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const sweep = await result.current.scanAll(['SOURCE_A', 'SOURCE_B'])

        expect(mocks.fetchDelegatedAddresses).toHaveBeenCalledTimes(2)
        expect(sweep.importedAddresses).toEqual(['IN_WALLET'])
        expect(sweep.candidates).toEqual([
            { address: 'NEW_A', sourceAddress: 'SOURCE_A' },
            { address: 'NEW_B', sourceAddress: 'SOURCE_B' },
        ])
        expect(sweep.failedSources).toEqual([])
    })

    it('lists a candidate found via two keys once', async () => {
        // An account has a single auth-addr, so this shouldn't happen — but
        // a duplicated indexer answer must not produce duplicate rows.
        mocks.fetchDelegatedAddresses.mockResolvedValue(['NEW_SAME'])

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const sweep = await result.current.scanAll(['SOURCE_A', 'SOURCE_B'])

        expect(sweep.candidates).toHaveLength(1)
        expect(sweep.candidates[0].address).toBe('NEW_SAME')
    })

    it('keeps scanning the remaining keys when one source fails', async () => {
        mocks.fetchDelegatedAddresses.mockImplementation(
            async (source: string) => {
                if (source === 'SOURCE_BAD') throw new Error('indexer down')
                return ['NEW_OK']
            },
        )

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const sweep = await result.current.scanAll([
            'SOURCE_BAD',
            'SOURCE_GOOD',
        ])

        expect(sweep.failedSources).toEqual(['SOURCE_BAD'])
        expect(sweep.candidates).toEqual([
            { address: 'NEW_OK', sourceAddress: 'SOURCE_GOOD' },
        ])
    })

    it('dedupes the source list before scanning', async () => {
        mocks.fetchDelegatedAddresses.mockResolvedValue([])

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        await result.current.scanAll(['SOURCE', 'SOURCE'])

        expect(mocks.fetchDelegatedAddresses).toHaveBeenCalledTimes(1)
    })

    it('classifies against the store as it is after all scans settle', async () => {
        mocks.fetchDelegatedAddresses.mockImplementation(async () => {
            // An import lands while the sweep is in flight — classification
            // must see it as already-in-wallet.
            setAccounts([testAccount('local', 'LANDS_MID_SCAN')])
            return ['LANDS_MID_SCAN']
        })

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        const sweep = await result.current.scanAll(['SOURCE'])

        expect(sweep.importedAddresses).toEqual(['LANDS_MID_SCAN'])
        expect(sweep.candidates).toEqual([])
    })

    it('reports progress as each key settles', async () => {
        mocks.fetchDelegatedAddresses.mockResolvedValue([])
        const progress: Array<[number, number]> = []

        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )
        await result.current.scanAll(['SOURCE_A', 'SOURCE_B'], {
            onProgress: (scanned, total) => progress.push([scanned, total]),
        })

        expect(progress).toEqual([
            [1, 2],
            [2, 2],
        ])
    })
})

describe('useRescanDelegatedAccounts — importFromSweep', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('groups candidates by their source key and persists each group', async () => {
        mocks.isValidAddress.mockReturnValue(true)
        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        let count = -1
        await act(async () => {
            count = await result.current.importFromSweep([
                { address: 'C1', sourceAddress: 'S1' },
                { address: 'C2', sourceAddress: 'S2' },
                { address: 'C3', sourceAddress: 'S1' },
            ])
        })

        expect(count).toBe(3)
        const persisted = useAccountsStore.getState().accounts
        const bySource = Object.fromEntries(
            persisted.map(a => [
                addressOn(a, MAINNET_SCOPE),
                authorityOf(a, MAINNET_SCOPE),
            ]),
        )
        expect(bySource).toEqual({ C1: 'S1', C2: 'S2', C3: 'S1' })
        persisted.forEach(account =>
            expect(account.custody).toEqual({ kind: 'watch' }),
        )
    })
})

describe('useRescanDelegatedAccounts — importSelected', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('returns 0 without persisting when the selection is empty', async () => {
        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        let count = -1
        await act(async () => {
            count = await result.current.importSelected('SOURCE', [])
        })

        expect(count).toBe(0)
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    it('returns 0 when every selected address fails format validation', async () => {
        mocks.isValidAddress.mockReturnValue(false)
        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        let count = -1
        await act(async () => {
            count = await result.current.importSelected('SOURCE', [
                'bad-1',
                'bad-2',
            ])
        })

        expect(count).toBe(0)
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    it('persists only the valid addresses as delegated watch accounts', async () => {
        mocks.isValidAddress.mockImplementation(
            (addr: string) => addr !== 'INVALID',
        )
        const { result } = renderHook(() =>
            useRescanDelegatedAccounts(MAINNET_SCOPE),
        )

        let count = -1
        await act(async () => {
            count = await result.current.importSelected('SOURCE', [
                'VALID_1',
                'INVALID',
                'VALID_2',
            ])
        })

        expect(count).toBe(2)
        const persisted = useAccountsStore.getState().accounts
        expect(persisted.map(a => addressOn(a, MAINNET_SCOPE)).sort()).toEqual([
            'VALID_1',
            'VALID_2',
        ])
        persisted.forEach(account => {
            expect(account.custody).toEqual({ kind: 'watch' })
            expect(authorityOf(account, MAINNET_SCOPE)).toBe('SOURCE')
        })
    })
})
