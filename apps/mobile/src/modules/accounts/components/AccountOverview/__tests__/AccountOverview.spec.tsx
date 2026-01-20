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
import React, { PropsWithChildren } from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import Decimal from 'decimal.js'
import { AccountOverview } from '../AccountOverview'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: vi.fn(() => ({
        portfolioAlgoValue: new Decimal('100'),
        portfolioFiatValue: new Decimal('200'),
        isPending: false,
        accountBalances: new Map(),
        isFetched: true,
        isRefetching: false,
        isError: false,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({ preferredCurrency: 'USD' })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(() => ({
        getPreference: vi.fn(() => true),
        setPreference: vi.fn(),
    })),
    useSettings: vi.fn(() => ({
        privacyMode: false,
        setPrivacyMode: vi.fn(),
    })),
}))

vi.mock('@hooks/useChartInteraction', () => ({
    useChartInteraction: vi.fn(() => ({
        period: '24H',
        setPeriod: vi.fn(),
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
    })),
}))

vi.mock('@components/WealthChart', () => ({
    WealthChart: () => null,
}))
vi.mock('@components/ChartPeriodSelection', () => ({
    ChartPeriodSelection: () => null,
}))
vi.mock('@components/WealthTrend', () => ({
    WealthTrend: () => null,
}))
vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: ({ value }: any) => <div>{value?.toString()}</div>,
}))
vi.mock('@components/ExpandablePanel', () => ({
    ExpandablePanel: ({ children }: PropsWithChildren) => children,
}))

// Mock sub-components to keep test focused
vi.mock('../../ButtonPanel', () => ({
    ButtonPanel: () => null,
}))
vi.mock('../../NoFundsButtonPanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NoFundsButtonPanel: (props: any) => (
        <div>
            <button onClick={props.onBuyAlgo}>Buy Algo</button>
            <button onClick={props.onReceive}>Receive</button>
            <button onClick={props.onAssetInbox}>Asset Inbox</button>
            <button onClick={props.onMore}>More</button>
        </div>
    ),
}))
vi.mock('../../AccountAssetList', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountAssetList: ({ header }: any) => <div>{header}</div>,
}))

vi.mock(
    '@modules/transactions/components/SendFunds/PWBottomSheet/SendFundsBottomSheet',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SendFundsBottomSheet: ({ isVisible }: any) =>
            isVisible ? <div data-testid='send-funds-sheet' /> : null,
    }),
)
vi.mock(
    '@modules/transactions/components/ReceiveFunds/PWBottomSheet/ReceiveFundsBottomSheet',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ReceiveFundsBottomSheet: ({ isVisible }: any) =>
            isVisible ? <div data-testid='receive-funds-sheet' /> : null,
    }),
)

describe('AccountOverview', () => {
    const mockAccount = { address: 'addr' } as WalletAccount

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders balance values', () => {
        render(<AccountOverview account={mockAccount} />)
        // Primary and secondary values
        expect(screen.getByText('100')).toBeTruthy()
        expect(screen.getByText('200')).toBeTruthy()
    })

    it('toggles privacy mode on press', async () => {
        const { useSettings } = await import('@perawallet/wallet-core-settings')
        const setPrivacyMode = vi.fn()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
            setPrivacyMode,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        render(<AccountOverview account={mockAccount} />)
        fireEvent.click(screen.getByText('100'))

        expect(setPrivacyMode).toHaveBeenCalledWith(true)
    })

    describe('when account has no balance', () => {
        beforeEach(async () => {
            const { useAccountBalancesQuery } = await import(
                '@perawallet/wallet-core-accounts'
            )
            vi.mocked(useAccountBalancesQuery).mockReturnValue({
                portfolioAlgoValue: new Decimal('0'),
                portfolioFiatValue: new Decimal('0'),
                isPending: false,
                accountBalances: new Map(),
                isFetched: true,
                isRefetching: false,
                isError: false,
            })
        })

        it('renders "no balance" view', () => {
            render(<AccountOverview account={mockAccount} />)
            expect(
                screen.getByText('account_details.no_balance.welcome'),
            ).toBeTruthy()
        })

        it('navigates to Fund screen when Buy Algo is pressed', () => {
            render(<AccountOverview account={mockAccount} />)
            fireEvent.click(screen.getByText('Buy Algo'))
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Fund',
            })
        })

        it('opens Receive Funds sheet when Receive is pressed', () => {
            render(<AccountOverview account={mockAccount} />)
            fireEvent.click(screen.getByText('Receive'))
            expect(screen.getByTestId('receive-funds-sheet')).toBeTruthy()
        })
        it('navigates to Notifications screen when Asset Inbox is pressed', () => {
            render(<AccountOverview account={mockAccount} />)
            fireEvent.click(screen.getByText('Asset Inbox'))
            expect(mockNavigate).toHaveBeenCalledWith('Notifications')
        })

        it('shows not implemented toast when More is pressed', () => {
            render(<AccountOverview account={mockAccount} />)
            fireEvent.click(screen.getByText('More'))
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'common.not_implemented.title',
                body: 'common.not_implemented.body',
                type: 'error',
            })
        })
    })
})
