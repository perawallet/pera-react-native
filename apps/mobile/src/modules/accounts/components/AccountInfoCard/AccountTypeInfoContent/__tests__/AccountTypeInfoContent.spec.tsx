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
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { AccountTypeInfoContent } from '../AccountTypeInfoContent'
import {
    type AccountLogicalType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: () => false,
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
    address: 'ALGO25ADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    keyPairId: 'key-1',
}

const watchAccount: WalletAccount = {
    type: 'watch',
    address: 'WATCHADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
}

describe('AccountTypeInfoContent', () => {
    const defaultProps = {
        onClose: vi.fn(),
        account: algo25Account,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountLogicalType.mockReturnValue('Algo25')
    })

    it('renders title and description for standard account', () => {
        render(<AccountTypeInfoContent {...defaultProps} />)

        expect(
            screen.getByText('account_type_info.standard_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_type_info.standard_description'),
        ).toBeTruthy()
    })

    it('renders title and description for watch account', () => {
        mockUseAccountLogicalType.mockReturnValue('NoAuth')
        render(
            <AccountTypeInfoContent
                {...defaultProps}
                account={watchAccount}
            />,
        )

        expect(screen.getByText('account_type_info.no_auth_title')).toBeTruthy()
        expect(
            screen.getByText('account_type_info.no_auth_description'),
        ).toBeTruthy()
    })

    it('renders learn more button', () => {
        render(<AccountTypeInfoContent {...defaultProps} />)

        expect(screen.getByText('account_type_info.learn_more')).toBeTruthy()
    })

    it('calls pushWebView when learn more is pressed', () => {
        render(<AccountTypeInfoContent {...defaultProps} />)

        fireEvent.click(screen.getByText('account_type_info.learn_more'))

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/category/accounts/',
        })
    })

    it('renders rekey actions for signable accounts', () => {
        render(<AccountTypeInfoContent {...defaultProps} />)

        expect(
            screen.getByTestId('account-type-action-rekey-to-ledger'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('account-type-action-rekey-to-standard'),
        ).toBeTruthy()
    })

    it('does not render rekey actions for watch accounts', () => {
        mockUseAccountLogicalType.mockReturnValue('NoAuth')
        render(
            <AccountTypeInfoContent
                {...defaultProps}
                account={watchAccount}
            />,
        )

        expect(
            screen.queryByTestId('account-type-action-rekey-to-ledger'),
        ).toBeNull()
        expect(
            screen.queryByTestId('account-type-action-rekey-to-standard'),
        ).toBeNull()
    })

    it('shows not implemented toast when rekey action is pressed', () => {
        render(<AccountTypeInfoContent {...defaultProps} />)

        fireEvent.click(
            screen.getByTestId('account-type-action-rekey-to-ledger'),
        )

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'common.not_implemented.title',
            body: 'common.not_implemented.body',
            type: 'error',
        })
    })
})
