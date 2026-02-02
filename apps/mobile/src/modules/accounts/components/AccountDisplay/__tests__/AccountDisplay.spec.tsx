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
import { AccountDisplay } from '../AccountDisplay'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        getAccountDisplayName: vi.fn(() => 'Test Account'),
    }
})

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({ preferredFiatCurrency: 'USD' })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

describe('AccountDisplay', () => {
    it('renders account name and truncated address', () => {
        const account = { address: 'LONGADDRESS1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF' } as WalletAccount
        render(<AccountDisplay account={account} />)
        expect(screen.getByText('Test Account')).toBeTruthy()
        // Verify truncation with 6 chars at start and end
        expect(screen.getByText(/LONGAD.*ABCDEF/)).toBeTruthy()
    })

    it('renders chevron by default', () => {
        const account = { address: 'addr' } as WalletAccount
        render(<AccountDisplay account={account} />)
        expect(screen.getByTestId('icon-chevron-down')).toBeTruthy()
    })

    it('does not render chevron when showChevron is false', () => {
        const account = { address: 'addr' } as WalletAccount
        render(
            <AccountDisplay
                account={account}
                showChevron={false}
            />,
        )
        expect(screen.queryByTestId('icon-chevron-down')).toBeNull()
    })
})
