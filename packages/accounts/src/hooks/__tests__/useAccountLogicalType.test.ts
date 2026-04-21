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
import { useAccountLogicalType } from '../useAccountLogicalType'
import { useAllAccountLogicalTypes } from '../useAllAccountLogicalTypes'
import { AccountLogicalTypes } from '../../logical-type'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

describe('useAccountLogicalType', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns RekeyedAuth when the stored rekeyAddress points to a signer in the store', () => {
        useAccountsStore.getState().setAccounts([
            {
                type: 'watch',
                address: 'A',
                rekeyAddress: 'S',
            } as unknown as WalletAccount,
            {
                type: 'algo25',
                address: 'S',
                keyPairId: 'k',
            } as unknown as WalletAccount,
        ])

        const { result } = renderHook(() => useAccountLogicalType('A'))
        expect(result.current).toBe(AccountLogicalTypes.RekeyedAuth)
    })

    it('returns Algo25 for a plain signer with no rekey', () => {
        useAccountsStore.getState().setAccounts([
            {
                type: 'algo25',
                address: 'S',
                keyPairId: 'k',
            } as unknown as WalletAccount,
        ])
        const { result } = renderHook(() => useAccountLogicalType('S'))
        expect(result.current).toBe(AccountLogicalTypes.Algo25)
    })

    it('returns null for an unknown address', () => {
        useAccountsStore.getState().setAccounts([])
        const { result } = renderHook(() => useAccountLogicalType('Z'))
        expect(result.current).toBeNull()
    })
})

describe('useAllAccountLogicalTypes', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it('returns a Map keyed by address', () => {
        useAccountsStore.getState().setAccounts([
            {
                type: 'watch',
                address: 'A',
                rekeyAddress: 'S',
            } as unknown as WalletAccount,
            {
                type: 'algo25',
                address: 'S',
                keyPairId: 'k',
            } as unknown as WalletAccount,
        ])
        const { result } = renderHook(() => useAllAccountLogicalTypes())
        expect(result.current.get('A')).toBe(AccountLogicalTypes.RekeyedAuth)
        expect(result.current.get('S')).toBe(AccountLogicalTypes.Algo25)
    })
})
