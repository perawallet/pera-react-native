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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountMenu } from '../AccountMenu'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: vi.fn(() => []),
        useSelectedAccountAddress: vi.fn(() => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: vi.fn(),
        })),
        useSelectedAccount: vi.fn(() => undefined),
        useAccountBalancesQuery: vi.fn(() => ({
            portfolioAlgoValue: '0',
            isPending: false,
            accountBalances: new Map(),
        })),
        usePortfolioTotals: vi.fn(() => ({
            portfolioPreferredValue: '0',
            accountPreferredValues: new Map(),
            isPending: false,
        })),
        useSortedAccounts: vi.fn(() => ({
            sortedAccounts: [],
            sortMode: 'manual',
            setSortMode: vi.fn(),
            manualAccountOrder: [],
            setManualAccountOrder: vi.fn(),
        })),
    }
})

// Mock child components
vi.mock('../../PortfolioView', () => ({
    PortfolioView: () => <div data-testid='PortfolioView' />,
}))

describe('AccountMenu', () => {
    it('renders account list and portfolio', () => {
        const onSelected = vi.fn()
        const onAddAccount = vi.fn()
        render(
            <AccountMenu
                onSelected={onSelected}
                onAddAccount={onAddAccount}
                onOpenSort={vi.fn()}
            />,
        )

        expect(screen.getByText('account_menu.title')).toBeTruthy()
        expect(screen.getByTestId('PortfolioView')).toBeTruthy()
    })

    it('calls onAddAccount when add account button is pressed', () => {
        const onSelected = vi.fn()
        const onAddAccount = vi.fn()
        render(
            <AccountMenu
                onSelected={onSelected}
                onAddAccount={onAddAccount}
                onOpenSort={vi.fn()}
            />,
        )

        const addButton = screen.getByTestId('account_menu_add_account_button')
        fireEvent.click(addButton)

        expect(onAddAccount).toHaveBeenCalledOnce()
    })
})
