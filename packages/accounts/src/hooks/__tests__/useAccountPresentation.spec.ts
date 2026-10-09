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
import { beforeEach, describe, expect, it } from 'vitest'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    fakePresentationOf,
} from '../../__tests__/fakeAccountsChain'
import {
    authorityTransitionLabel,
    useAccountPresentation,
} from '../useAccountPresentation'

describe('useAccountPresentation', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('describes the account the way its chain does, given the held accounts', () => {
        const account = testAccount('multisig', 'MSIG')
        const other = testAccount('local', 'LOCAL')
        useAccountsStore.getState().setAccounts([account, other])

        const { result } = renderHook(() =>
            useAccountPresentation(account, MAINNET_SCOPE),
        )

        expect(result.current).toEqual(fakePresentationOf(account))
        expect(
            fakeAccountsChain().adapter.presentation.describe,
        ).toHaveBeenCalledWith(account, [account, other], MAINNET_SCOPE)
    })

    it('describes the account again on a network switch', () => {
        const account = testAccount('multisig', 'MSIG')
        useAccountsStore.getState().setAccounts([account])
        const { describe: describeAccount } =
            fakeAccountsChain().adapter.presentation
        const { rerender } = renderHook(
            ({ scope }) => useAccountPresentation(account, scope),
            { initialProps: { scope: MAINNET_SCOPE } },
        )

        rerender({ scope: TESTNET_SCOPE })

        expect(describeAccount).toHaveBeenLastCalledWith(
            account,
            [account],
            TESTNET_SCOPE,
        )
    })

    it('is null for no account', () => {
        const { result } = renderHook(() =>
            useAccountPresentation(null, MAINNET_SCOPE),
        )

        expect(result.current).toBeNull()
        expect(
            fakeAccountsChain().adapter.presentation.describe,
        ).not.toHaveBeenCalled()
    })
})

describe('authorityTransitionLabel', () => {
    it('words the transition the way the chain does', () => {
        const from = testAccount('watch', 'FROM')
        const to = testAccount('hardware', 'TO')

        expect(authorityTransitionLabel({ from, to }, FAKE_CHAIN_ID)).toEqual({
            labelKey: 'fake.transition.label',
            signerKey: 'fake.hardware.signer',
            descriptionKey: 'fake.transition.watch_to_hardware',
        })
        expect(
            fakeAccountsChain().adapter.presentation.transitionLabel,
        ).toHaveBeenCalledWith(from, to)
    })
})
