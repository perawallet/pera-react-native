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
import { useRekeyTransition } from '../useRekeyTransition'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useRekeyTransition', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns null when no address is provided', () => {
        const { result } = renderHook(() => useRekeyTransition(null))
        expect(result.current).toBeNull()
    })

    it('returns null when the address is not in the wallet', () => {
        setAccounts([])
        const { result } = renderHook(() => useRekeyTransition('A'))
        expect(result.current).toBeNull()
    })

    it('returns null for a non-rekeyed account', () => {
        setAccounts([
            { type: 'algo25', address: 'A', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useRekeyTransition('A'))
        expect(result.current).toBeNull()
    })

    it('returns the from/to account types for a signable rekey', () => {
        setAccounts([
            { type: 'watch', address: 'A', rekeyAddress: 'S' } as WalletAccount,
            { type: 'algo25', address: 'S', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useRekeyTransition('A'))
        expect(result.current).toEqual({ from: 'watch', to: 'algo25' })
    })
})
