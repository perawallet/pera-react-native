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
import { withCustody } from '../../credentials'
import type { WalletAccount } from '../../models'
import {
    fakeAccountsChain,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    ({
        id: address,
        type: 'algo25',
        address,
        keyPairId: 'k',
        ...extra,
    }) as WalletAccount

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useAuthorityTargets', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        registerFakeAccountsChain()
    })

    it('passes the kind, source, accounts and quantum flag to the chain and keeps the accepted targets', () => {
        const source = held('SRC')
        const good = held('GOOD')
        const bad = held('BAD')
        setAccounts([source, good, bad])
        const { authority } = fakeAccountsChain().adapter
        vi.mocked(authority!.isEligibleTarget).mockImplementation(
            (_kind, target) => target.address === 'GOOD',
        )

        const { result } = renderHook(() =>
            useAuthorityTargets(source, 'quantum', {
                isQuantumTargetEnabled: true,
            }),
        )

        expect(result.current).toEqual([withCustody(good)])
        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'quantum',
            withCustody(good),
            source,
            [source, good, bad].map(withCustody),
            { isQuantumTargetEnabled: true },
        )
    })

    it('returns nothing for a missing source', () => {
        setAccounts([held('A')])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockReturnValue(true)

        const { result } = renderHook(() =>
            useAuthorityTargets(null, 'standard'),
        )

        expect(result.current).toEqual([])
    })

    it('returns nothing on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })
        const source = held('SRC')
        setAccounts([source, held('A')])

        const { result } = renderHook(() =>
            useAuthorityTargets(source, 'standard'),
        )

        expect(result.current).toEqual([])
    })
})
