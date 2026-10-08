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
import { authorityOf } from '../../credentials/accessors'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useSignerFor } from '../useSignerFor'
import { useCanSignWith } from '../useCanSignWith'
import { useRekeyAccount } from '../useRekeyAccount'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import {
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'

const held = (address: string, extra: Partial<WalletAccount> = {}) =>
    ({
        id: address,
        custody: { kind: 'local', seed: 'algo25' },
        address,
        keyPairId: 'k',
        ...extra,
    }) as WalletAccount

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

beforeEach(() => {
    useAccountsStore.getState().resetState()
    useAccountChainStateStore.getState().resetState()
    useNetworkStore.getState().setNetwork('mainnet')
    registerFakeAccountsChain()
})

describe('useSignerFor', () => {
    it('returns the signer the chain resolves', () => {
        const auth = held('S')
        setAccounts([held('A'), auth])
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer: auth,
        })

        const { result } = renderHook(() => useSignerFor('A'))

        expect(result.current).toBe(auth)
    })

    it('returns null when the chain names no signer', () => {
        setAccounts([held('A')])
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.resolveSigner).mockReturnValue({
            kind: 'watch',
            account: held('A'),
        })

        const { result } = renderHook(() => useSignerFor('A'))

        expect(result.current).toBeNull()
    })

    it('follows a rekey held on one network across a network switch', () => {
        const auth = held('S')
        const account = held('A')
        setAccounts([account, auth])
        vi.mocked(fakeAccountsChain().adapter.resolveSigner).mockImplementation(
            (target, accounts, scope) => ({
                kind: 'ok',
                signer:
                    accounts.find(
                        a => a.address === authorityOf(target, scope),
                    ) ?? target,
            }),
        )
        seedAuthority('A', 'S', TESTNET_SCOPE)
        useNetworkStore.getState().setNetwork('mainnet')

        const { result } = renderHook(() => useSignerFor('A'))
        expect(result.current).toBe(account)

        act(() => useNetworkStore.getState().setNetwork('testnet'))
        expect(result.current).toBe(auth)

        act(() => seedAuthority('A', null, TESTNET_SCOPE))
        expect(result.current).toBe(account)
    })

    it('returns null for an unknown address', () => {
        setAccounts([])
        const { result } = renderHook(() => useSignerFor('Z'))
        expect(result.current).toBeNull()
    })
})

describe('useCanSignWith', () => {
    it('is true when the chain resolves a signer', () => {
        const account = held('A')
        setAccounts([account])
        const { result } = renderHook(() => useCanSignWith(account))
        expect(result.current).toBe(true)
    })

    it('is false when the chain resolves none', () => {
        const account = held('A', {
            custody: { kind: 'watch' },
            keyPairId: undefined,
        })
        setAccounts([account])
        const { result } = renderHook(() => useCanSignWith(account))
        expect(result.current).toBe(false)
    })
})

describe('useRekeyAccount', () => {
    it("returns the chain's auth account for a rekeyed account", () => {
        const auth = held('S')
        seedAuthority('A', 'S')
        setAccounts([held('A'), auth])
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.getAuthAccount).mockReturnValue(auth)

        const { result } = renderHook(() => useRekeyAccount('A'))

        expect(result.current).toBe(auth)
    })

    it('returns null when the account is not rekeyed', () => {
        setAccounts([held('A')])
        const { result } = renderHook(() => useRekeyAccount('A'))
        expect(result.current).toBeNull()
    })

    it('returns null when the chain cannot find the auth account', () => {
        seedAuthority('A', 'MISSING')
        setAccounts([held('A')])
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.getAuthAccount).mockReturnValue(null)

        const { result } = renderHook(() => useRekeyAccount('A'))

        expect(result.current).toBeNull()
    })
})
