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
import { renderHook, act } from '@testing-library/react'
import { useAccountTypeInfo } from '../useAccountTypeInfo'
import type {
    AccountLogicalType,
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
            return key
        },
    }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        accountTypeSupportUrl:
            'https://support.perawallet.app/en/category/accounts/',
        ledgerAccountSupportUrl:
            'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
    },
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

describe('useAccountTypeInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        mockUseRekeyTransition.mockReturnValue(null)
    })

    it('resolves Algo25 account type', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.standard_title')
        expect(result.current.description).toBe(
            'account_type_info.standard_description',
        )
    })

    it('resolves LedgerBle account type', () => {
        mockUseAccountLogicalType.mockReturnValue('LedgerBle')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.ledger_title')
        expect(result.current.description).toBe(
            'account_type_info.ledger_description',
        )
    })

    it('resolves HdKey account type', () => {
        mockUseAccountLogicalType.mockReturnValue('HdKey')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.hd_wallet_title')
        expect(result.current.description).toBe(
            'account_type_info.hd_wallet_description',
        )
    })

    it('resolves Multisig account type', () => {
        mockUseAccountLogicalType.mockReturnValue('Multisig')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.multisig_title')
        expect(result.current.description).toBe(
            'account_type_info.multisig_description',
        )
    })

    it('resolves RekeyedAuth account type without a known auth account as generic rekeyed', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        mockUseRekeyTransition.mockReturnValue(null)
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_standard_title',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_standard_description',
        )
    })

    it('resolves a standard-to-ledger rekey with the split transition title', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        mockUseRekeyTransition.mockReturnValue({
            from: 'Algo25',
            to: 'LedgerBle',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('Rekeyed')
        expect(result.current.titleQualifier).toBe('(Standard to Ledger)')
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_ledger_description',
        )
    })

    it('resolves a ledger-to-ledger rekey with the ledger-to-ledger description', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        mockUseRekeyTransition.mockReturnValue({
            from: 'LedgerBle',
            to: 'LedgerBle',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.description).toBe(
            'account_type_info.rekeyed_ledger_to_ledger_description',
        )
    })

    it('resolves Rekeyed account type as No Auth (locked-out)', () => {
        mockUseAccountLogicalType.mockReturnValue('Rekeyed')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.no_auth_title')
    })

    it('resolves NoAuth account type as Watch', () => {
        mockUseAccountLogicalType.mockReturnValue('NoAuth')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        expect(result.current.title).toBe('account_type_info.watch_title')
        expect(result.current.description).toBe(
            'account_type_info.watch_description',
        )
    })

    it('opens webview with support URL when learn more is pressed', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/category/accounts/',
        })
    })

    it('opens webview with rekey article when learn more is pressed for Ledger', () => {
        mockUseAccountLogicalType.mockReturnValue('LedgerBle')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
        })
    })
})
