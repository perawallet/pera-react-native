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
import PortfolioView from '../PortfolioView'
import { UserPreferences } from '@constants/user-preferences'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountBalancesQuery: vi.fn(() => ({
            portfolioAlgoValue: '100',
            portfolioFiatValue: '200',
            isPending: false,
        })),
        useAllAccounts: vi.fn(() => []),
    }
})

vi.mock('@perawallet/wallet-core-settings', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-settings')
        >()
    return {
        ...actual,
        usePreferences: () => ({
            getPreference: () => true,
            setPreference: vi.fn(),
        }),
    }
})

// Mock complex child components
vi.mock('@components/WealthChart', () => ({
    default: 'WealthChart',
}))
vi.mock('@components/WealthTrend', () => ({
    default: 'WealthTrend',
}))
vi.mock('@components/ChartPeriodSelection', () => ({
    default: 'ChartPeriodSelection',
}))

describe('PortfolioView', () => {
    it('renders correctly', () => {
        render(<PortfolioView />)
        expect(screen.getByText('portfolio.title')).toBeTruthy()
    })
})
