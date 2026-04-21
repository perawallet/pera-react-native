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
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
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
    },
}))

const mockUseAccountLogicalType = vi.fn<() => AccountLogicalType | null>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountLogicalType: () => mockUseAccountLogicalType(),
    }
})

const algo25Account: WalletAccount = {
    type: 'algo25',
    address: 'ALGO25ADDR',
    keyPairId: 'key-1',
}

describe('useAccountTypeInfo', () => {
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountLogicalType.mockReturnValue('Algo25')
    })

    it('resolves Algo25 account type', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.standard_title')
        expect(result.current.description).toBe(
            'account_type_info.standard_description',
        )
    })

    it('resolves LedgerBle account type', () => {
        mockUseAccountLogicalType.mockReturnValue('LedgerBle')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.ledger_title')
        expect(result.current.description).toBe(
            'account_type_info.ledger_description',
        )
    })

    it('resolves HdKey account type', () => {
        mockUseAccountLogicalType.mockReturnValue('HdKey')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.hd_wallet_title')
        expect(result.current.description).toBe(
            'account_type_info.hd_wallet_description',
        )
    })

    it('resolves Multisig account type', () => {
        mockUseAccountLogicalType.mockReturnValue('Multisig')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.multisig_title')
        expect(result.current.description).toBe(
            'account_type_info.multisig_description',
        )
    })

    it('resolves RekeyedAuth account type', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_standard_title',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_standard_description',
        )
    })

    it('resolves Rekeyed account type', () => {
        mockUseAccountLogicalType.mockReturnValue('Rekeyed')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_standard_title',
        )
    })

    it('resolves NoAuth account type', () => {
        mockUseAccountLogicalType.mockReturnValue('NoAuth')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.no_auth_title')
        expect(result.current.description).toBe(
            'account_type_info.no_auth_description',
        )
    })

    it('returns rekey actions for signing accounts', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.actions).toHaveLength(2)
        expect(result.current.actions[0].id).toBe('rekey-to-ledger')
        expect(result.current.actions[1].id).toBe('rekey-to-standard')
    })

    it('returns undo-rekey + rescan for RekeyedAuth', () => {
        mockUseAccountLogicalType.mockReturnValue('RekeyedAuth')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        const ids = result.current.actions.map(a => a.id)
        expect(ids).toContain('undo-rekey')
        expect(ids).toContain('rescan-rekeyed')
    })

    it('returns rescan only for Rekeyed (no undo-rekey)', () => {
        mockUseAccountLogicalType.mockReturnValue('Rekeyed')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        const ids = result.current.actions.map(a => a.id)
        expect(ids).toContain('rescan-rekeyed')
        expect(ids).not.toContain('undo-rekey')
    })

    it('returns no actions for NoAuth accounts', () => {
        mockUseAccountLogicalType.mockReturnValue('NoAuth')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.actions).toHaveLength(0)
    })

    it('calls notImplemented toast and onClose when action is pressed', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        act(() => {
            result.current.actions[0].onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.not_implemented.title',
            body: 'common.not_implemented.body',
            type: 'error',
        })
        expect(onClose).toHaveBeenCalled()
    })

    it('opens webview with support URL when learn more is pressed', () => {
        mockUseAccountLogicalType.mockReturnValue('Algo25')
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/category/accounts/',
        })
    })
})
