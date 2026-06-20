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
import { useHasHDWallet } from '../useHasHDWallet'
import { useAccountsStore } from '../../store'
import { AccountTypes, type WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useHasHDWallet', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns false for an empty wallet', () => {
        setAccounts([])
        const { result } = renderHook(() => useHasHDWallet())
        expect(result.current).toBe(false)
    })

    it('returns false when the wallet holds only non-HD accounts', () => {
        setAccounts([
            { type: AccountTypes.algo25, address: 'A' } as WalletAccount,
            { type: AccountTypes.watch, address: 'W' } as WalletAccount,
        ])
        const { result } = renderHook(() => useHasHDWallet())
        expect(result.current).toBe(false)
    })

    it('returns true when at least one HD account exists', () => {
        setAccounts([
            { type: AccountTypes.algo25, address: 'A' } as WalletAccount,
            { type: AccountTypes.hdWallet, address: 'H' } as WalletAccount,
        ])
        const { result } = renderHook(() => useHasHDWallet())
        expect(result.current).toBe(true)
    })
})
