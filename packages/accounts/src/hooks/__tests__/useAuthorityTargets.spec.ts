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
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useAuthorityTargets } from '../useAuthorityTargets'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    testAccount('local', address, { id: address, ...extra })

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useAuthorityTargets', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        registerFakeAccountsChain()
    })

    it("passes the kind, source, accounts and the chain's options through and keeps the accepted targets", () => {
        const source = held('SRC')
        const good = held('GOOD')
        const bad = held('BAD')
        setAccounts([source, good, bad])
        const { authority } = fakeAccountsChain().adapter
        vi.mocked(authority!.isEligibleTarget).mockImplementation(
            (_kind, target) => target.id === 'GOOD',
        )

        const { result } = renderHook(() =>
            useAuthorityTargets(source, 'fake-target-local', MAINNET_SCOPE, {
                someChainSwitch: true,
            }),
        )

        expect(result.current).toEqual([good])
        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fake-target-local',
            good,
            source,
            [source, good, bad],
            MAINNET_SCOPE,
            { someChainSwitch: true },
        )
    })

    it('asks the chain on the scope it is given', () => {
        const source = held('SRC')
        setAccounts([source, held('A')])
        const { authority } = fakeAccountsChain().adapter

        renderHook(() =>
            useAuthorityTargets(source, 'fake-target-local', TESTNET_SCOPE),
        )

        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'fake-target-local',
            expect.anything(),
            source,
            expect.any(Array),
            TESTNET_SCOPE,
            {},
        )
    })

    it('returns nothing for a missing source', () => {
        setAccounts([held('A')])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockReturnValue(true)

        const { result } = renderHook(() =>
            useAuthorityTargets(null, 'fake-target-local', MAINNET_SCOPE),
        )

        expect(result.current).toEqual([])
    })

    it('returns nothing on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })
        const source = held('SRC')
        setAccounts([source, held('A')])

        const { result } = renderHook(() =>
            useAuthorityTargets(source, 'fake-target-local', MAINNET_SCOPE),
        )

        expect(result.current).toEqual([])
    })
})
