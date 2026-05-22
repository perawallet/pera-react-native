/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useSignerFor } from '../useSignerFor'
import { useCanSignWith } from '../useCanSignWith'
import { useRekeyAccount } from '../useRekeyAccount'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useSignerFor', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns the auth account when rekeyed to a local signer', () => {
        setAccounts([
            { type: 'watch', address: 'A', rekeyAddress: 'S' } as WalletAccount,
            { type: 'algo25', address: 'S', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useSignerFor('A'))
        expect(result.current?.address).toBe('S')
    })

    it('returns the account itself when it holds its own key', () => {
        setAccounts([
            { type: 'algo25', address: 'A', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useSignerFor('A'))
        expect(result.current?.address).toBe('A')
    })

    it('returns null for an unknown address', () => {
        setAccounts([])
        const { result } = renderHook(() => useSignerFor('Z'))
        expect(result.current).toBeNull()
    })
})

describe('useCanSignWith', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns true for a signable account', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'k',
        } as WalletAccount
        setAccounts([account])
        const { result } = renderHook(() => useCanSignWith(account))
        expect(result.current).toBe(true)
    })

    it('returns false for a watch account', () => {
        const account = { type: 'watch', address: 'A' } as WalletAccount
        setAccounts([account])
        const { result } = renderHook(() => useCanSignWith(account))
        expect(result.current).toBe(false)
    })
})

describe('useRekeyAccount', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns the rekey target when present in the wallet', () => {
        setAccounts([
            { type: 'watch', address: 'A', rekeyAddress: 'S' } as WalletAccount,
            { type: 'algo25', address: 'S', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useRekeyAccount('A'))
        expect(result.current?.address).toBe('S')
    })

    it('returns null when the account is not rekeyed', () => {
        setAccounts([
            { type: 'algo25', address: 'A', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useRekeyAccount('A'))
        expect(result.current).toBeNull()
    })

    it('returns null when the rekey target is unknown locally', () => {
        setAccounts([
            {
                type: 'watch',
                address: 'A',
                rekeyAddress: 'MISSING',
            } as WalletAccount,
        ])
        const { result } = renderHook(() => useRekeyAccount('A'))
        expect(result.current).toBeNull()
    })
})
