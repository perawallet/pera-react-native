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
import {
    useAuthorityTargetCategories,
    useAuthorityTargets,
} from '../useAuthorityTargets'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'
import {
    AuthorityTargetCategories,
    type AuthorityTargetCategory,
} from '../../chain-adapter'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    testAccount('local', address, { id: address, ...extra })

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

// A fresh fake whose authority lists `targetKinds` instead of its own.
const withTargetKinds = (
    targetKinds: { id: string; category: AuthorityTargetCategory }[],
) => {
    const { authority } = registerFakeAccountsChain().adapter
    return registerFakeAccountsChain({
        authority: { ...authority!, targetKinds },
    })
}

describe('useAuthorityTargets', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        registerFakeAccountsChain()
    })

    it("asks the chain about each of the category's kinds and keeps the accepted targets", () => {
        const source = held('SRC')
        const good = held('GOOD')
        const bad = held('BAD')
        setAccounts([source, good, bad])
        const { authority } = fakeAccountsChain().adapter
        vi.mocked(authority!.isEligibleTarget).mockImplementation(
            (_kindId, target) => target.id === 'GOOD',
        )

        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.standard,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([good])
        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fake-target-local',
            good,
            source,
            [source, good, bad],
            MAINNET_SCOPE,
        )
        expect(authority!.isEligibleTarget).not.toHaveBeenCalledWith(
            'fake-target-hardware',
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        )
    })

    it('follows a kind the chain renames', () => {
        const source = held('SRC')
        const target = held('A')
        setAccounts([source, target])
        const { adapter } = withTargetKinds([
            { id: 'renamed-local', category: 'standard' },
        ])
        vi.mocked(adapter.authority!.isEligibleTarget).mockImplementation(
            kindId => kindId === 'renamed-local',
        )

        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.standard,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([source, target])
    })

    it("lists the targets of every kind the chain adds to a category, in the wallet's order", () => {
        const source = held('SRC')
        const first = held('FIRST')
        const second = held('SECOND')
        setAccounts([source, first, second])
        const { adapter } = withTargetKinds([
            { id: 'ledger-like', category: 'hardware' },
            { id: 'card-like', category: 'hardware' },
        ])
        vi.mocked(adapter.authority!.isEligibleTarget).mockImplementation(
            (kindId, target) =>
                (kindId === 'card-like' && target.id === 'FIRST') ||
                (kindId === 'ledger-like' && target.id === 'SECOND'),
        )

        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.hardware,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([first, second])
    })

    it('lists nothing for a category the chain files no kind under', () => {
        const source = held('SRC')
        setAccounts([source, held('A')])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockReturnValue(true)

        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.postQuantum,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([])
    })

    it('asks the chain on the scope it is given', () => {
        const source = held('SRC')
        setAccounts([source, held('A')])
        const { authority } = fakeAccountsChain().adapter

        renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.standard,
                TESTNET_SCOPE,
            ),
        )

        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fake-target-local',
            expect.anything(),
            source,
            expect.any(Array),
            TESTNET_SCOPE,
        )
    })

    it('picks up an authority recorded after mount', () => {
        const source = held('SRC')
        const target = held('A')
        setAccounts([source, target])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockImplementation(
            (_kindId, _target, from, _accounts, scope) =>
                authorityOf(from, scope) !== null,
        )
        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.standard,
                MAINNET_SCOPE,
            ),
        )
        expect(result.current).toEqual([])

        act(() => seedAuthority('SRC', 'AUTH'))

        expect(result.current).toEqual([source, target])
    })

    it('returns nothing for a missing source', () => {
        setAccounts([held('A')])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockReturnValue(true)

        const { result } = renderHook(() =>
            useAuthorityTargets(
                null,
                AuthorityTargetCategories.standard,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([])
    })

    it('returns nothing on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })
        const source = held('SRC')
        setAccounts([source, held('A')])

        const { result } = renderHook(() =>
            useAuthorityTargets(
                source,
                AuthorityTargetCategories.standard,
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toEqual([])
    })
})

describe('useAuthorityTargetCategories', () => {
    it('lists each category the chain files a kind under once, in its order', () => {
        withTargetKinds([
            { id: 'ledger', category: AuthorityTargetCategories.hardware },
            { id: 'ed', category: AuthorityTargetCategories.standard },
            { id: 'ledger-2', category: AuthorityTargetCategories.hardware },
        ])

        const { result } = renderHook(() =>
            useAuthorityTargetCategories(MAINNET_SCOPE),
        )

        expect(result.current).toEqual([
            AuthorityTargetCategories.hardware,
            AuthorityTargetCategories.standard,
        ])
    })

    it('lists nothing on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })

        const { result } = renderHook(() =>
            useAuthorityTargetCategories(MAINNET_SCOPE),
        )

        expect(result.current).toEqual([])
    })
})
