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
