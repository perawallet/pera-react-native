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
import { render, screen } from '@test-utils/render'
import { AccountIcon } from '../AccountIcon'
import {
    AccountLogicalType,
    AccountLogicalTypes,
    AccountTypes,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockUseAccountLogicalType = vi.fn<() => AccountLogicalType | null>(
    () => AccountLogicalTypes.Algo25,
)

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountLogicalType: (...args: unknown[]) =>
            mockUseAccountLogicalType(...(args as [])),
    }
})

const account = { address: 'addr' } as WalletAccount

describe('AccountIcon', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Algo25)
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(false)
    })

    it('renders correct icon for HdKey account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.HdKey)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for Algo25 account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Algo25)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/algo25-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for LedgerBle account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.LedgerBle)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/ledger-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for Multisig account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Multisig)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/multisig-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for NoAuth account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.NoAuth)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/noauth-account'),
        ).toBeTruthy()
    })

    it('renders rekeyed-standard icon for Rekeyed account', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Rekeyed)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-standard'),
        ).toBeTruthy()
    })

    it('renders rekeyed-standard icon for RekeyedAuth account', () => {
        mockUseAccountLogicalType.mockReturnValue(
            AccountLogicalTypes.RekeyedAuth,
        )

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-standard'),
        ).toBeTruthy()
    })

    it('renders rekeyed-ledger icon when a hardware account is rekeyed', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Rekeyed)
        const hardwareAccount = {
            address: 'addr',
            type: AccountTypes.hardware,
        } as WalletAccount

        render(<AccountIcon account={hardwareAccount} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-ledger'),
        ).toBeTruthy()
    })

    it('renders rekeyed-ledger icon when a hardware account is RekeyedAuth', () => {
        mockUseAccountLogicalType.mockReturnValue(
            AccountLogicalTypes.RekeyedAuth,
        )
        const hardwareAccount = {
            address: 'addr',
            type: AccountTypes.hardware,
        } as WalletAccount

        render(<AccountIcon account={hardwareAccount} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-ledger'),
        ).toBeTruthy()
    })

    it('renders correct icon in dark mode', async () => {
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(true)
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.HdKey)

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/dark/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders nothing when no account is provided', () => {
        const { container } = render(<AccountIcon />)

        expect(container.innerHTML).not.toContain('icon-')
    })

    it('renders nothing when logical type is null', () => {
        mockUseAccountLogicalType.mockReturnValue(null)

        const { container } = render(<AccountIcon account={account} />)

        expect(container.innerHTML).not.toContain('icon-')
    })

    it('passes size prop to PWIcon', () => {
        mockUseAccountLogicalType.mockReturnValue(AccountLogicalTypes.Algo25)

        render(
            <AccountIcon
                account={account}
                size='xl'
            />,
        )

        expect(
            screen.getByTestId('icon-accounts/light/algo25-account'),
        ).toBeTruthy()
    })
})
