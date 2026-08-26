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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountTypeLabel } from '../useAccountTypeLabel'
import type {
    MultiSigAccount,
    RekeyTransition,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (key === 'account_info.type_rekeyed_signer')
                return `Rekeyed (Signed by ${params?.to})`
            if (key === 'account_info.rekey_signer_ledger')
                return 'a Ledger account'
            if (params?.count != null) return `${key} (${params.count})`
            return key
        },
    }),
}))

const mockUseCanSignWith = vi.fn<() => boolean>()
const mockUseRekeyTransition = vi.fn<() => RekeyTransition | null>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useCanSignWith: () => mockUseCanSignWith(),
        useRekeyTransition: () => mockUseRekeyTransition(),
    }
})

const accountOfType = (type: WalletAccount['type']): WalletAccount =>
    ({
        type,
        address: `${type.toUpperCase()}_ADDR`,
        keyPairId: 'key-1',
    }) as WalletAccount

const rekeyedAccount: WalletAccount = {
    id: 'rekeyed-account',
    type: 'algo25',
    address: 'REKEYED_ADDR',
    keyPairId: 'key-1',
    rekeyAddress: 'AUTH_ADDR',
}

const multisigAccount: MultiSigAccount = {
    id: 'multisig-account',
    type: 'multisig',
    address: 'MULTISIG_ADDR',
    multisigDetails: { threshold: 2, addresses: ['A', 'B', 'C'], version: 1 },
}

describe('useAccountTypeLabel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseCanSignWith.mockReturnValue(true)
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
        ['hdWallet', 'account_info.type_universal_wallet'],
        ['algo25', 'account_info.type_algo25'],
        ['hardware', 'account_info.type_ledger'],
        ['watch', 'account_info.type_watch'],
        ['quantum', 'account_info.type_quantum'],
    ] as const)('maps non-rekeyed %s account to label %s', (type, expected) => {
        const { result } = renderHook(() =>
            useAccountTypeLabel(accountOfType(type)),
        )
        expect(result.current).toEqual({
            label: expected,
            main: expected,
            qualifier: null,
        })
    })

    it('uses a plain shared account label for a signable multisig account', () => {
        mockUseCanSignWith.mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountTypeLabel(multisigAccount),
        )
        expect(result.current).toEqual({
            label: 'account_info.type_multisig',
            main: 'account_info.type_multisig',
            qualifier: null,
        })
    })

    it('renders the no-auth label for a multisig account when we cannot sign', () => {
        mockUseCanSignWith.mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountTypeLabel(multisigAccount),
        )
        expect(result.current).toEqual({
            label: 'account_info.type_no_auth',
            main: 'account_info.type_no_auth',
            qualifier: null,
        })
    })

    it('splits the signer qualifier for a rekeyed signable account', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseRekeyTransition.mockReturnValue({
            from: 'watch',
            to: 'hardware',
        })
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'Rekeyed (Signed by a Ledger account)',
            main: 'Rekeyed',
            qualifier: '(Signed by a Ledger account)',
        })
    })

    it('falls back to a plain rekeyed label when the auth account is unknown', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseRekeyTransition.mockReturnValue(null)
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'account_info.type_rekeyed',
            main: 'account_info.type_rekeyed',
            qualifier: null,
        })
    })

    it('renders the no-auth label for a rekeyed account when we cannot sign', () => {
        mockUseCanSignWith.mockReturnValue(false)
        mockUseRekeyTransition.mockReturnValue(null)
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'account_info.type_no_auth',
            main: 'account_info.type_no_auth',
            qualifier: null,
        })
    })
})
