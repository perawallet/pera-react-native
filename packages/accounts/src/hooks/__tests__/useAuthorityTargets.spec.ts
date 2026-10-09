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
import { useAuthorityTargets } from '../useAuthorityTargets'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    ({
        id: address,
        custody: { kind: 'local', seed: null },
        address,
        keyPairId: 'k',
        ...extra,
    }) as WalletAccount

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useAuthorityTargets', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        useNetworkStore.getState().setNetwork('mainnet')
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

        expect(result.current).toEqual([good])
        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'quantum',
            good,
            source,
            [source, good, bad],
            MAINNET_SCOPE,
            { isQuantumTargetEnabled: true },
        )
    })

    it('picks up an authority recorded after mount', () => {
        const source = held('SRC')
        const target = held('A')
        setAccounts([source, target])
        vi.mocked(
            fakeAccountsChain().adapter.authority!.isEligibleTarget,
        ).mockImplementation(
            (_kind, _target, from, _accounts, scope) =>
                authorityOf(from, scope) !== null,
        )
        const { result } = renderHook(() =>
            useAuthorityTargets(source, 'standard'),
        )
        expect(result.current).toEqual([])

        act(() => seedAuthority('SRC', 'AUTH'))

        expect(result.current).toEqual([source, target])
    })

    it('asks the chain on the selected network', () => {
        const source = held('SRC')
        setAccounts([source, held('A')])
        const { authority } = fakeAccountsChain().adapter
        useNetworkStore.getState().setNetwork('testnet')

        renderHook(() => useAuthorityTargets(source, 'standard'))

        expect(authority!.isEligibleTarget).toHaveBeenCalledWith(
            'standard',
            expect.anything(),
            source,
            expect.any(Array),
            TESTNET_SCOPE,
            { isQuantumTargetEnabled: false },
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
