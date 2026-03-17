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
import { AccountStatus, WalletAccount } from '@perawallet/wallet-core-accounts'

const mockResolveAccountStatus = vi.fn<() => AccountStatus>(() => 'standard')

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    resolveAccountStatus: (...args: unknown[]) =>
        mockResolveAccountStatus(...(args as [])),
    useAllAccounts: vi.fn(() => []),
}))

const account = { address: 'addr' } as WalletAccount

describe('AccountIcon', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mockResolveAccountStatus.mockReturnValue('standard')
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(false)
    })

    it('renders correct icon for HD wallet account', () => {
        mockResolveAccountStatus.mockReturnValue('hdWallet')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for standard account', () => {
        mockResolveAccountStatus.mockReturnValue('standard')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/algo25-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for ledger account', () => {
        mockResolveAccountStatus.mockReturnValue('ledger')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/ledger-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for watch account', () => {
        mockResolveAccountStatus.mockReturnValue('watch')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/watch-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for multisig account', () => {
        mockResolveAccountStatus.mockReturnValue('multisig')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/multisig-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for noAuth account', () => {
        mockResolveAccountStatus.mockReturnValue('noAuth')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/noauth-account'),
        ).toBeTruthy()
    })

    it('renders correct icon for rekeyedStandard account', () => {
        mockResolveAccountStatus.mockReturnValue('rekeyedStandard')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-standard'),
        ).toBeTruthy()
    })

    it('renders correct icon for rekeyedLedger account', () => {
        mockResolveAccountStatus.mockReturnValue('rekeyedLedger')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/rekeyed-ledger'),
        ).toBeTruthy()
    })

    it('renders correct icon in dark mode', async () => {
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(true)
        mockResolveAccountStatus.mockReturnValue('hdWallet')

        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/dark/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders nothing when no account is provided', () => {
        const { container } = render(<AccountIcon />)

        expect(container.innerHTML).not.toContain('icon-')
    })

    it('passes size prop to PWIcon', () => {
        mockResolveAccountStatus.mockReturnValue('standard')

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
