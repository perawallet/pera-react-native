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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import { useAccountsRekeyedTo } from '../useAccountsRekeyedTo'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useAccountsRekeyedTo', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns an empty list when no address is provided', () => {
        setAccounts([
            {
                type: 'algo25',
                address: 'A',
                rekeyAddress: 'PQ',
            } as WalletAccount,
        ])
        const { result } = renderHook(() => useAccountsRekeyedTo(null))
        expect(result.current).toEqual([])
    })

    it('reads the store to find the accounts rekeyed to the address', () => {
        const rekeyed = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'k',
            rekeyAddress: 'PQ',
        } as WalletAccount
        const target = {
            type: 'quantum',
            address: 'PQ',
            keyPairId: 'k2',
        } as WalletAccount
        setAccounts([rekeyed, target])

        const { result } = renderHook(() => useAccountsRekeyedTo('PQ'))
        expect(result.current).toEqual([rekeyed])
    })

    it('returns an empty list when nothing is rekeyed to the address', () => {
        setAccounts([
            { type: 'quantum', address: 'PQ', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useAccountsRekeyedTo('PQ'))
        expect(result.current).toEqual([])
    })
})
