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
import { useRescanRekeyedAccounts } from '../useRescanRekeyedAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const mocks = vi.hoisted(() => ({
    fetchRekeyedAddresses: vi.fn(),
    isValidAlgorandAddress: vi.fn(),
}))

vi.mock('../../account-discovery', () => ({
    fetchRekeyedAddresses: mocks.fetchRekeyedAddresses,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    isValidAlgorandAddress: mocks.isValidAlgorandAddress,
}))

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useRescanRekeyedAccounts — scan', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('classifies discovered addresses into already-imported vs importable', async () => {
        setAccounts([
            {
                type: 'algo25',
                address: 'IN_WALLET',
                keyPairId: 'k',
            } as WalletAccount,
        ])
        mocks.fetchRekeyedAddresses.mockResolvedValue(['IN_WALLET', 'NEW_ONE'])

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        const scanResult = await result.current.scan('SOURCE')

        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledWith(
            'SOURCE',
            'mainnet',
        )
        expect(scanResult).toEqual({
            importedAddresses: ['IN_WALLET'],
            notImportedAddresses: ['NEW_ONE'],
        })
    })

    it('returns empty classification when the indexer reports nothing', async () => {
        mocks.fetchRekeyedAddresses.mockResolvedValue([])

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        const scanResult = await result.current.scan('SOURCE')

        expect(scanResult).toEqual({
            importedAddresses: [],
            notImportedAddresses: [],
        })
    })
})

describe('useRescanRekeyedAccounts — scanAll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('fans out one indexer scan per source key and merges classified results', async () => {
        setAccounts([
            {
                type: 'algo25',
                address: 'IN_WALLET',
                keyPairId: 'k',
            } as WalletAccount,
        ])
        mocks.fetchRekeyedAddresses.mockImplementation(
            async (source: string) =>
                source === 'SOURCE_A' ? ['IN_WALLET', 'NEW_A'] : ['NEW_B'],
        )

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        const sweep = await result.current.scanAll(['SOURCE_A', 'SOURCE_B'])

        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledTimes(2)
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
        mocks.fetchRekeyedAddresses.mockResolvedValue(['NEW_SAME'])

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        const sweep = await result.current.scanAll(['SOURCE_A', 'SOURCE_B'])

        expect(sweep.candidates).toHaveLength(1)
        expect(sweep.candidates[0].address).toBe('NEW_SAME')
    })

    it('keeps scanning the remaining keys when one source fails', async () => {
        mocks.fetchRekeyedAddresses.mockImplementation(
            async (source: string) => {
                if (source === 'SOURCE_BAD') throw new Error('indexer down')
                return ['NEW_OK']
            },
        )

        const { result } = renderHook(() => useRescanRekeyedAccounts())
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
        mocks.fetchRekeyedAddresses.mockResolvedValue([])

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        await result.current.scanAll(['SOURCE', 'SOURCE'])

        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledTimes(1)
    })

    it('classifies against the store as it is after all scans settle', async () => {
        mocks.fetchRekeyedAddresses.mockImplementation(async () => {
            // An import lands while the sweep is in flight — classification
            // must see it as already-in-wallet.
            setAccounts([
                {
                    type: 'algo25',
                    address: 'LANDS_MID_SCAN',
                    keyPairId: 'k',
                } as WalletAccount,
            ])
            return ['LANDS_MID_SCAN']
        })

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        const sweep = await result.current.scanAll(['SOURCE'])

        expect(sweep.importedAddresses).toEqual(['LANDS_MID_SCAN'])
        expect(sweep.candidates).toEqual([])
    })

    it('reports progress as each key settles', async () => {
        mocks.fetchRekeyedAddresses.mockResolvedValue([])
        const progress: Array<[number, number]> = []

        const { result } = renderHook(() => useRescanRekeyedAccounts())
        await result.current.scanAll(['SOURCE_A', 'SOURCE_B'], {
            onProgress: (scanned, total) => progress.push([scanned, total]),
        })

        expect(progress).toEqual([
            [1, 2],
            [2, 2],
        ])
    })
})

describe('useRescanRekeyedAccounts — importFromSweep', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('groups candidates by their source key and persists each group', async () => {
        mocks.isValidAlgorandAddress.mockReturnValue(true)
        const { result } = renderHook(() => useRescanRekeyedAccounts())

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
            persisted.map(a => [a.address, a.rekeyAddress]),
        )
        expect(bySource).toEqual({ C1: 'S1', C2: 'S2', C3: 'S1' })
        persisted.forEach(account => expect(account.type).toBe('watch'))
    })
})

describe('useRescanRekeyedAccounts — importSelected', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('returns 0 without persisting when the selection is empty', async () => {
        const { result } = renderHook(() => useRescanRekeyedAccounts())

        let count = -1
        await act(async () => {
            count = await result.current.importSelected('SOURCE', [])
        })

        expect(count).toBe(0)
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    it('returns 0 when every selected address fails format validation', async () => {
        mocks.isValidAlgorandAddress.mockReturnValue(false)
        const { result } = renderHook(() => useRescanRekeyedAccounts())

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

    it('persists only the valid addresses as rekeyed watch accounts', async () => {
        mocks.isValidAlgorandAddress.mockImplementation(
            (addr: string) => addr !== 'INVALID',
        )
        const { result } = renderHook(() => useRescanRekeyedAccounts())

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
        expect(persisted.map(a => a.address).sort()).toEqual([
            'VALID_1',
            'VALID_2',
        ])
        persisted.forEach(account => {
            expect(account.type).toBe('watch')
            expect(account.rekeyAddress).toBe('SOURCE')
        })
    })
})
