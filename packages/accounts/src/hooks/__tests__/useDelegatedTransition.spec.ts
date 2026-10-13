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
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useDelegatedTransition } from '../useDelegatedTransition'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    testAccount('local', address, { id: address, ...extra })

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useDelegatedTransition', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        registerFakeAccountsChain()
        useNetworkStore.getState().setNetwork('mainnet')
    })

    it('returns null when no address is provided', () => {
        const { result } = renderHook(() =>
            useDelegatedTransition(null, 'algorand'),
        )
        expect(result.current).toBeNull()
    })

    it('returns null when the address is not in the wallet', () => {
        setAccounts([])
        const { result } = renderHook(() =>
            useDelegatedTransition('A', 'algorand'),
        )
        expect(result.current).toBeNull()
    })

    it('returns null for a non-rekeyed account', () => {
        setAccounts([held('A')])
        const { result } = renderHook(() =>
            useDelegatedTransition('A', 'algorand'),
        )
        expect(result.current).toBeNull()
    })

    it("returns the account and the chain's signer for a rekeyed account", () => {
        const signer = held('S')
        const rekeyed = testAccount('watch', 'A', { id: 'A' })
        seedAuthority('A', 'S')
        setAccounts([rekeyed, signer])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer,
        })

        const { result } = renderHook(() =>
            useDelegatedTransition('A', 'algorand'),
        )

        expect(result.current).toEqual({ from: rekeyed, to: signer })
    })

    it('picks up an authority recorded after mount', () => {
        const signer = held('S')
        const rekeyed = testAccount('watch', 'A', { id: 'A' })
        setAccounts([rekeyed, signer])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer,
        })
        const { result } = renderHook(() =>
            useDelegatedTransition('A', 'algorand'),
        )
        expect(result.current).toBeNull()

        act(() => seedAuthority('A', 'S'))

        expect(result.current).toEqual({ from: rekeyed, to: signer })
    })
})
