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
import { useCanInitiateRekey } from '../useCanInitiateRekey'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useCanInitiateRekey', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns false when no account is provided', () => {
        const { result } = renderHook(() => useCanInitiateRekey(null))
        expect(result.current).toBe(false)
    })

    it('returns true for a signable standard account', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'k',
        } as WalletAccount
        setAccounts([account])
        const { result } = renderHook(() => useCanInitiateRekey(account))
        expect(result.current).toBe(true)
    })

    it('returns false for a watch account with no signable auth chain', () => {
        const account = { type: 'watch', address: 'A' } as WalletAccount
        setAccounts([account])
        const { result } = renderHook(() => useCanInitiateRekey(account))
        expect(result.current).toBe(false)
    })

    it('returns true for a watch account rekeyed to a signable auth account', () => {
        // Exercises the store-read path: the hook must resolve the auth
        // account ('S') out of the store to find the signable chain.
        const account = {
            type: 'watch',
            address: 'A',
            rekeyAddress: 'S',
        } as WalletAccount
        const auth = {
            type: 'algo25',
            address: 'S',
            keyPairId: 'k',
        } as WalletAccount
        setAccounts([account, auth])
        const { result } = renderHook(() => useCanInitiateRekey(account))
        expect(result.current).toBe(true)
    })
})
