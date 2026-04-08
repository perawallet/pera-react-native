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
import { WalletAccount } from '@perawallet/wallet-core-accounts'

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

const mockUseAllAccounts = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

const algo25Account: WalletAccount = {
    type: 'algo25',
    address: 'ALGO25ADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    keyPairId: 'key-1',
}

const ledgerAccount: WalletAccount = {
    type: 'hardware',
    address: 'LEDGERADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWX',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'test-device',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
    },
    keyPairId: 'key-2',
}

const watchAccount: WalletAccount = {
    type: 'watch',
    address: 'WATCHADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
}

const hdWalletAccount: WalletAccount = {
    type: 'hdWallet',
    address: 'HDWALLETADDR1234567890ABCDEFGHIJKLMNOPQRSTUV',
    keyPairId: 'key-3',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

const multisigAccount: WalletAccount = {
    type: 'multisig',
    address: 'MULTISIGADDR1234567890ABCDEFGHIJKLMNOPQRSTUV',
    multisigDetails: {
        threshold: 2,
        addresses: [
            'ALGO25ADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            'LEDGERADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWX',
        ],
    },
}

const rekeyedWithAuthAccount: WalletAccount = {
    type: 'algo25',
    address: 'REKEYEDADDR1234567890ABCDEFGHIJKLMNOPQRSTUVW',
    rekeyAddress: 'ALGO25ADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    keyPairId: 'key-4',
}

const rekeyedToLedgerAccount: WalletAccount = {
    type: 'algo25',
    address: 'REKEYLEDGADDR1234567890ABCDEFGHIJKLMNOPQRSTUV',
    rekeyAddress: 'LEDGERADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWX',
    keyPairId: 'key-5',
}

const rekeyedNoAuthAccount: WalletAccount = {
    type: 'algo25',
    address: 'REKEYNOAUTHADDR1234567890ABCDEFGHIJKLMNOPQRST',
    rekeyAddress: 'UNKNOWNADDR1234567890ABCDEFGHIJKLMNOPQRSTUV',
    keyPairId: 'key-6',
}

describe('useAccountTypeInfo', () => {
    const onClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([
            algo25Account,
            ledgerAccount,
            watchAccount,
            hdWalletAccount,
        ])
    })

    it('resolves standard account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.standard_title')
        expect(result.current.description).toBe(
            'account_type_info.standard_description',
        )
    })

    it('resolves ledger account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: ledgerAccount, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.ledger_title')
        expect(result.current.description).toBe(
            'account_type_info.ledger_description',
        )
    })

    it('resolves watch account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: watchAccount, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.watch_title')
        expect(result.current.description).toBe(
            'account_type_info.watch_description',
        )
    })

    it('resolves HD wallet account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: hdWalletAccount, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.hd_wallet_title')
        expect(result.current.description).toBe(
            'account_type_info.hd_wallet_description',
        )
    })

    it('resolves multisig account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: multisigAccount, onClose }),
        )

        expect(result.current.title).toBe('account_type_info.multisig_title')
        expect(result.current.description).toBe(
            'account_type_info.multisig_description',
        )
    })

    it('resolves rekeyed to standard account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: rekeyedWithAuthAccount,
                onClose,
            }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_standard_title',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_standard_description',
        )
    })

    it('resolves rekeyed to ledger account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: rekeyedToLedgerAccount,
                onClose,
            }),
        )

        expect(result.current.title).toBe(
            'account_type_info.rekeyed_ledger_title',
        )
        expect(result.current.description).toBe(
            'account_type_info.rekeyed_ledger_description',
        )
    })

    it('resolves no auth rekeyed account type', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: rekeyedNoAuthAccount,
                onClose,
            }),
        )

        expect(result.current.title).toBe('account_type_info.no_auth_title')
        expect(result.current.description).toBe(
            'account_type_info.no_auth_description',
        )
    })

    it('returns rekey actions for signable accounts', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: algo25Account, onClose }),
        )

        expect(result.current.actions).toHaveLength(2)
        expect(result.current.actions[0].id).toBe('rekey-to-ledger')
        expect(result.current.actions[1].id).toBe('rekey-to-standard')
    })

    it('returns undo rekey action for rekeyed account with signing keys', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: rekeyedWithAuthAccount,
                onClose,
            }),
        )

        const undoAction = result.current.actions.find(
            a => a.id === 'undo-rekey',
        )
        expect(undoAction).toBeDefined()
    })

    it('returns rescan rekeyed action for rekeyed accounts', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({
                account: rekeyedNoAuthAccount,
                onClose,
            }),
        )

        const rescanAction = result.current.actions.find(
            a => a.id === 'rescan-rekeyed',
        )
        expect(rescanAction).toBeDefined()
    })

    it('returns no actions for watch accounts', () => {
        const { result } = renderHook(() =>
            useAccountTypeInfo({ account: watchAccount, onClose }),
        )

        expect(result.current.actions).toHaveLength(0)
    })

    it('calls notImplemented toast and onClose when action is pressed', () => {
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
