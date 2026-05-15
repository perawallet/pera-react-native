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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountTypeLabel } from '../useAccountTypeLabel'
import type {
    AccountLogicalType,
    MultiSigAccount,
    RekeyTransition,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (key === 'account_info.type_rekeyed_transition')
                return `Rekeyed (${params?.from} to ${params?.to})`
            if (key === 'account_info.rekey_part_standard') return 'Standard'
            if (key === 'account_info.rekey_part_ledger') return 'Ledger'
            if (params?.count != null) return `${key} (${params.count})`
            return key
        },
    }),
}))

const mockUseAccountLogicalType = vi.fn<() => AccountLogicalType | null>()
const mockUseRekeyTransition = vi.fn<() => RekeyTransition | null>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountLogicalType: () => mockUseAccountLogicalType(),
        useRekeyTransition: () => mockUseRekeyTransition(),
    }
})

const algo25Account: WalletAccount = {
    type: 'algo25',
    address: 'ALGO25ADDR',
    keyPairId: 'key-1',
}

const multisigAccount: MultiSigAccount = {
    type: 'multisig',
    address: 'MULTISIG_ADDR',
    multisigDetails: { threshold: 2, addresses: ['A', 'B', 'C'] },
}

describe('useAccountTypeLabel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        mockUseRekeyTransition.mockReturnValue(null)
    })

    it('returns an empty label when no account is provided', () => {
        const { result } = renderHook(() => useAccountTypeLabel(undefined))
        expect(result.current).toEqual({
            label: '',
            main: '',
            qualifier: null,
        })
    })

    it.each([
        ['HdKey', 'account_info.type_universal_wallet'],
        ['Algo25', 'account_info.type_algo25'],
        ['LedgerBle', 'account_info.type_ledger'],
        ['NoAuth', 'account_info.type_watch'],
        ['Rekeyed', 'account_info.type_no_auth'],
    ] as const)('maps %s to a plain label %s', (logicalType, expected) => {
        mockUseAccountLogicalType.mockReturnValue(logicalType)
        const { result } = renderHook(() => useAccountTypeLabel(algo25Account))
        expect(result.current).toEqual({
            label: expected,
            main: expected,
            qualifier: null,
        })
    })

    it('uses a plain shared account label for a multisig account', () => {
        mockUseAccountLogicalType.mockReturnValue('Multisig')
        const { result } = renderHook(() =>
            useAccountTypeLabel(multisigAccount),
        )
        expect(result.current).toEqual({
            label: 'account_info.type_multisig',
            main: 'account_info.type_multisig',
            qualifier: null,
        })
    })

    it('splits the transition qualifier for a rekeyed signable account', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        mockUseRekeyTransition.mockReturnValue({
            from: 'Algo25',
            to: 'LedgerBle',
        })
        const { result } = renderHook(() => useAccountTypeLabel(algo25Account))
        expect(result.current).toEqual({
            label: 'Rekeyed (Standard to Ledger)',
            main: 'Rekeyed',
            qualifier: '(Standard to Ledger)',
        })
    })

    it('falls back to a plain rekeyed label when the auth account is unknown', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        mockUseRekeyTransition.mockReturnValue(null)
        const { result } = renderHook(() => useAccountTypeLabel(algo25Account))
        expect(result.current).toEqual({
            label: 'account_info.type_rekeyed',
            main: 'account_info.type_rekeyed',
            qualifier: null,
        })
    })
})
