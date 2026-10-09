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
import { renderHook, act } from '@testing-library/react'
import { useAccountTypeInfo } from '../useAccountTypeInfo'
import {
    useAccountChainStateStore,
    type DelegateTransition,
    type WalletAccount,
    type AccountType,
} from '@perawallet/wallet-core-accounts'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import { custodyForType } from '@test-utils/accountCustody'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (key === 'account_info.type_rekeyed_signer')
                return `Rekeyed (Signed by ${params?.to})`
            if (key === 'account_info.rekey_signer_ledger')
                return 'a Ledger account'
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
        multisigSupportUrl:
            'https://support.perawallet.app/en/article/introduction-to-joint-accounts-1j0dt2g/',
        quantumAccountSupportUrl:
            'https://support.perawallet.app/en/article/create-or-upgrade-to-a-quantum-account-on-pera-wallet-19d53rn/',
    },
    registerCustomNetworkSource: vi.fn(() => () => undefined),
}))

const mockUseCanSignWith = vi.fn<() => boolean>()
const mockUseDelegatedTransition = vi.fn<() => DelegateTransition | null>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useCanSignWith: () => mockUseCanSignWith(),
        useDelegatedTransition: () => mockUseDelegatedTransition(),
    }
})

const accountOfType = (
    type: AccountType,
    authority?: string,
): WalletAccount => {
    const address = `${type.toUpperCase()}_ADDR`
    if (authority) seedAuthority(address, authority)
    return {
        custody: custodyForType(type),
        address,
        keyPairId: 'key-1',
    } as WalletAccount
}

describe('useAccountTypeInfo', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        useAccountChainStateStore.getState().resetState()
        vi.clearAllMocks()
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
    })

    it('resolves algo25 account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('standalone') }),
        )

        expect(result.current.title).toBe('account_type_info.standard_title')
        expect(result.current.description).toBe(
            'account_type_info.standard_description',
        )
    })

    it('resolves hardware account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('hardware') }),
        )

        expect(result.current.title).toBe('account_type_info.ledger_title')
        expect(result.current.description).toBe(
            'account_type_info.ledger_description',
        )
    })

    it('resolves hdWallet account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('hdWallet') }),
        )

        expect(result.current.title).toBe('account_type_info.hd_wallet_title')
        expect(result.current.description).toBe(
            'account_type_info.hd_wallet_description',
        )
    })

    it('resolves multisig account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('multisig') }),
        )

        expect(result.current.title).toBe('account_type_info.multisig_title')
        expect(result.current.description).toBe(
            'account_type_info.multisig_description',
        )
    })

    it('resolves an unsignable multisig account as No Auth', () => {
        mockUseCanSignWith.mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('multisig') }),
        )

        expect(result.current.title).toBe('account_type_info.no_auth_title')
        expect(result.current.description).toBe(
            'account_type_info.multisig_no_auth_description',
        )
    })

    it('resolves signable rekeyed account without a known auth as generic rekeyed', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: accountOfType('standalone', 'AUTH'),
            }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_standard_title',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_standard_description',
        )
    })

    it('resolves a rekey to a Ledger auth account with the split signer title', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue({
            from: 'watch',
            to: 'hardware',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('watch', 'AUTH') }),
        )

        expect(result.current.title).toBe('Rekeyed')
        expect(result.current.titleQualifier).toBe(
            '(Signed by a Ledger account)',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_ledger_description',
        )
    })

    it('resolves a shared-to-shared rekey with the shared description', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue({
            from: 'multisig',
            to: 'multisig',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('multisig', 'AUTH') }),
        )

        expect(result.current.description).toBe(
            'account_type_info.rekeyed_shared_description',
        )
    })

    it('resolves a ledger-to-ledger rekey with the ledger-to-ledger description', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue({
            from: 'hardware',
            to: 'hardware',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('hardware', 'AUTH') }),
        )

        expect(result.current.description).toBe(
            'account_type_info.rekeyed_ledger_to_ledger_description',
        )
    })

    it('resolves an unsignable rekeyed account as No Auth', () => {
        mockUseCanSignWith.mockReturnValue(false)
        mockUseDelegatedTransition.mockReturnValue(null)
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: accountOfType('standalone', 'AUTH'),
            }),
        )

        expect(result.current.title).toBe('account_type_info.no_auth_title')
    })

    it('resolves quantum account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('quantum') }),
        )

        expect(result.current.title).toBe('account_type_info.quantum_title')
        expect(result.current.description).toBe(
            'account_type_info.quantum_description',
        )
    })

    it('resolves watch account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('watch') }),
        )

        expect(result.current.title).toBe('account_type_info.watch_title')
        expect(result.current.description).toBe(
            'account_type_info.watch_description',
        )
    })

    it('opens webview with support URL when learn more is pressed', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('standalone') }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/category/accounts/',
        })
    })

    it('opens webview with the shared-accounts article when learn more is pressed for a shared account', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('multisig') }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/introduction-to-joint-accounts-1j0dt2g/',
        })
    })

    it('opens webview with the quantum article when learn more is pressed for a quantum account', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('quantum') }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/create-or-upgrade-to-a-quantum-account-on-pera-wallet-19d53rn/',
        })
    })

    it('opens webview with the quantum article when learn more is pressed for an account rekeyed to quantum', () => {
        mockUseDelegatedTransition.mockReturnValue({
            from: 'standalone',
            to: 'quantum',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: accountOfType('standalone', 'AUTH'),
            }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/create-or-upgrade-to-a-quantum-account-on-pera-wallet-19d53rn/',
        })
    })

    it('opens webview with the quantum article when learn more is pressed for a Ledger account rekeyed to quantum', () => {
        mockUseDelegatedTransition.mockReturnValue({
            from: 'hardware',
            to: 'quantum',
        })
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('hardware', 'AUTH') }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/create-or-upgrade-to-a-quantum-account-on-pera-wallet-19d53rn/',
        })
    })

    it('opens webview with rekey article when learn more is pressed for Ledger', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: accountOfType('hardware') }),
        )

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/',
        })
    })
})
