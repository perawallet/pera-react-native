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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { AccountIcon } from '../AccountIcon'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isHDWalletAccount: vi.fn(),
    isAlgo25Account: vi.fn(),
    isLedgerAccount: vi.fn(),
    isWatchAccount: vi.fn(),
    isRekeyedAccount: vi.fn(),
}))

describe('AccountIcon', () => {
    it('renders correct icon for HD wallet account', async () => {
        const { isHDWalletAccount } = await import(
            '@perawallet/wallet-core-accounts'
        )
        vi.mocked(isHDWalletAccount).mockReturnValue(true)

        const account = { address: 'addr' } as WalletAccount
        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders correct icon in dark mode', async () => {
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(true)
        const {
            isHDWalletAccount,
            isAlgo25Account,
            isLedgerAccount,
            isWatchAccount,
            isRekeyedAccount,
        } = await import('@perawallet/wallet-core-accounts')
        vi.mocked(isHDWalletAccount).mockReturnValue(true)
        vi.mocked(isAlgo25Account).mockReturnValue(false)
        vi.mocked(isLedgerAccount).mockReturnValue(false)
        vi.mocked(isWatchAccount).mockReturnValue(false)
        vi.mocked(isRekeyedAccount).mockReturnValue(false)

        const account = { address: 'addr' } as WalletAccount
        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/dark/hdwallet-account'),
        ).toBeTruthy()
    })

    it('renders unknown account icon when no specific type matches', async () => {
        const { useIsDarkMode } = await import('@hooks/useIsDarkMode')
        vi.mocked(useIsDarkMode).mockReturnValue(false)
        const {
            isHDWalletAccount,
            isAlgo25Account,
            isLedgerAccount,
            isWatchAccount,
            isRekeyedAccount,
        } = await import('@perawallet/wallet-core-accounts')
        vi.mocked(isHDWalletAccount).mockReturnValue(false)
        vi.mocked(isAlgo25Account).mockReturnValue(false)
        vi.mocked(isLedgerAccount).mockReturnValue(false)
        vi.mocked(isWatchAccount).mockReturnValue(false)
        vi.mocked(isRekeyedAccount).mockReturnValue(false)

        const account = { address: 'addr' } as WalletAccount
        render(<AccountIcon account={account} />)

        expect(
            screen.getByTestId('icon-accounts/light/unknown-account'),
        ).toBeTruthy()
    })
})
