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

import { render, screen } from '@test-utils/render'
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
            portfolioFiatValue: '0',
            isPending: false,
        })),
    }
})

// Mock child components
vi.mock('../PortfolioView', () => ({
    PortfolioView: 'PortfolioView',
}))

// Mock InboxTab and AccountsTab if they are complex, but they are in same file/folder?
// They are in same folder, so they are imported. We can mock them if needed, but shallow test might be better.
// For now, let's rely on shallow rendering or just basic render.

describe('AccountMenu', () => {
    it('renders tabs', () => {
        const onSelected = vi.fn()
        render(
            <AccountMenu
                onSelected={onSelected}
                showInbox={true}
            />,
        )
        // Tab and TabView should render
        expect(screen.getByTestId('Tab')).toBeTruthy()
        expect(screen.getByTestId('TabView')).toBeTruthy()
    })
})
