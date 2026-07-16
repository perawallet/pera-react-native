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
import { describe, expect, it, beforeEach } from 'vitest'
import { useIsRekeyedUnsignable } from '../useIsRekeyedUnsignable'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const setAccounts = (accounts: WalletAccount[]) =>
    useAccountsStore.getState().setAccounts(accounts)

describe('useIsRekeyedUnsignable', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns false when no account is provided', () => {
        const { result } = renderHook(() => useIsRekeyedUnsignable(null))
        expect(result.current).toBe(false)
    })

    it('returns false for a non-rekeyed account', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'k',
        } as WalletAccount
        setAccounts([account])
        const { result } = renderHook(() => useIsRekeyedUnsignable(account))
        expect(result.current).toBe(false)
    })

    it('returns true when rekeyed to an unsignable (watch) auth account', () => {
        const account = {
            type: 'watch',
            address: 'A',
            rekeyAddress: 'W',
        } as WalletAccount
        setAccounts([account, { type: 'watch', address: 'W' } as WalletAccount])
        const { result } = renderHook(() => useIsRekeyedUnsignable(account))
        expect(result.current).toBe(true)
    })

    it('returns false when rekeyed to a locally-signable auth account', () => {
        const account = {
            type: 'watch',
            address: 'A',
            rekeyAddress: 'S',
        } as WalletAccount
        setAccounts([
            account,
            { type: 'algo25', address: 'S', keyPairId: 'k' } as WalletAccount,
        ])
        const { result } = renderHook(() => useIsRekeyedUnsignable(account))
        expect(result.current).toBe(false)
    })
})
