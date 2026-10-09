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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { addressOn, authorityOf } from '../../credentials/accessors'
import { testAccount } from '../../__tests__/accountFactory'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import {
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'
import { useSigningAccounts } from '../useSigningAccounts'

const watch = testAccount('watch', 'W', { id: 'W' })
const signer = testAccount('local', 'S', { id: 'S' })

describe('useSigningAccounts', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        useNetworkStore.getState().setNetwork('mainnet')
        registerFakeAccountsChain()
    })

    it('picks up an authority recorded after mount', () => {
        useAccountsStore.getState().setAccounts([watch, signer])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockImplementation(
            (account, accounts, scope) => {
                const auth = accounts.find(
                    a => addressOn(a, scope) === authorityOf(account, scope),
                )
                if (auth) return { kind: 'ok', signer: auth }
                return account.custody.kind === 'watch'
                    ? { kind: 'watch', account }
                    : { kind: 'ok', signer: account }
            },
        )
        const { result } = renderHook(() => useSigningAccounts('algorand'))
        expect(result.current).toEqual([signer])

        act(() => seedAuthority('W', 'S'))

        expect(result.current).toEqual([watch, signer])
    })
})
