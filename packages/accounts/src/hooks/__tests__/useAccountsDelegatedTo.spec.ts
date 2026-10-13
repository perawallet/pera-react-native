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

import { act, renderHook } from '@testing-library/react'
import { authorityOf } from '../../credentials/accessors'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useAccountsDelegatedTo } from '../useAccountsDelegatedTo'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    MAINNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    testAccount('local', address, { id: address, ...extra })

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useAccountsDelegatedTo', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        registerFakeAccountsChain()
    })

    it('returns an empty list when no address is provided', () => {
        seedAuthority('A', 'PQ')
        setAccounts([held('A')])
        const { result } = renderHook(() =>
            useAccountsDelegatedTo(null, 'algorand'),
        )
        expect(result.current).toEqual([])
    })

    it('asks the chain which accounts are delegated to the address', () => {
        const rekeyed = held('A')
        seedAuthority('A', 'PQ')
        const target = testAccount('explicit', 'PQ', { id: 'PQ' })
        setAccounts([rekeyed, target])
        const { authority } = fakeAccountsChain().adapter
        vi.mocked(authority!.accountsDelegatedTo).mockReturnValue([rekeyed])

        const { result } = renderHook(() =>
            useAccountsDelegatedTo('PQ', 'algorand'),
        )

        expect(result.current).toEqual([rekeyed])
        expect(authority!.accountsDelegatedTo).toHaveBeenCalledWith('PQ', [
            rekeyed,
            target,
        ])
    })

    it('picks up an authority recorded after mount', () => {
        const rekeyed = held('A')
        setAccounts([rekeyed, held('PQ')])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.accountsDelegatedTo,
        ).mockImplementation((address, accounts) =>
            accounts.filter(a => authorityOf(a, MAINNET_SCOPE) === address),
        )
        const { result } = renderHook(() =>
            useAccountsDelegatedTo('PQ', 'algorand'),
        )
        expect(result.current).toEqual([])

        act(() => seedAuthority('A', 'PQ'))

        expect(result.current).toEqual([rekeyed])
    })

    it('returns an empty list on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })
        seedAuthority('A', 'PQ')
        setAccounts([held('A'), held('PQ')])
        const { result } = renderHook(() =>
            useAccountsDelegatedTo('PQ', 'algorand'),
        )
        expect(result.current).toEqual([])
    })
})
