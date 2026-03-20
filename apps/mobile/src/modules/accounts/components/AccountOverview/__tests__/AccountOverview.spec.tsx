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

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({
        copyToClipboard: vi.fn(),
    }),
}))

vi.mock('react-native-tab-view', () => ({
    TabView: () => null,
    TabBar: () => null,
    SceneMap: () => null,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: vi.fn(() => ({
        portfolioAlgoValue: new Decimal('100'),
        isPending: false,
        accountBalances: new Map(),
        isFetched: true,
        isRefetching: false,
        isError: false,
    })),
    usePortfolioTotals: vi.fn(() => ({
        portfolioUsdValue: new Decimal('200'),
        accountUsdValues: new Map(),
        isPending: false,
    })),
    useSelectedAccount: vi.fn(() => undefined),
    isWatchAccount: vi.fn(() => false),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(() => ({
        setSelectedAccount: vi.fn(),
        setCanSelectAccount: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        usdToPreferred: vi.fn((amount: Decimal) => amount),
        algoUsdPrice: new Decimal(0),
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: null,
        isPending: false,
    })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(() => ({
        privacyMode: false,
        setPrivacyMode: vi.fn(),
    })),
}))

vi.mock('@hooks/useChartInteraction', () => ({
    useChartInteraction: vi.fn(() => ({
        period: 'one-day' as const,
        setPeriod: vi.fn(),
        selectedPoint: null,
        setSelectedPoint: vi.fn(),
        clearSelection: vi.fn(),
    })),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style, ...rest }: any) => (
        <div
            style={style}
            {...rest}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, style }: any) => <span style={style}>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress, style }: any) => (
        <button
            onClick={onPress}
            style={style}
        >
            {children}
        </button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWHeader: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: ({ value }: any) => (
        <div data-testid='currency-display'>{value?.toString()}</div>
    ),
}))

vi.mock('@components/PreferredCurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PreferredCurrencyDisplay: ({ sourceAmount }: any) => (
        <div data-testid='preferred-currency-display'>
            {sourceAmount?.toString()}
        </div>
    ),
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

// Mock sub-components to keep test focused
vi.mock('../../ButtonPanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ButtonPanel: (props: any) => (
        <div>
            <button onClick={props.onReceive}>Receive</button>
        </div>
    ),
}))
vi.mock('../../NoFundsButtonPanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NoFundsButtonPanel: (props: any) => (
        <div>
            <button onClick={props.onBuyAlgo}>Buy Algo</button>
            <button onClick={props.onReceive}>Receive</button>
            <button onClick={props.onMore}>More</button>
        </div>
    ),
}))
vi.mock('../../WatchAccountButtonPanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WatchAccountButtonPanel: (props: any) => (
        <div>
            <button onClick={props.onCopyAddress}>Copy Address</button>
            <button onClick={props.onShowQR}>Show QR</button>
            <button onClick={props.onMore}>More</button>
        </div>
    ),
}))
vi.mock('../../AccountAssetList', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountAssetList: ({ header, children }: any) => (
        <div>
            {header}
            {children}
        </div>
    ),
}))

vi.mock(
    '@modules/transactions/components/send-funds/SendFundsBottomSheet/SendFundsBottomSheet',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SendFundsBottomSheet: ({ isVisible }: any) =>
            isVisible ? <div data-testid='send-funds-sheet' /> : null,
    }),
)
vi.mock(
    '@modules/transactions/components/receive-funds/ReceiveFundsBottomSheet',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ReceiveFundsBottomSheet: ({ isVisible }: any) =>
            isVisible ? <div data-testid='receive-funds-sheet' /> : null,
    }),
)
vi.mock('../../AccountOptionsBottomSheet', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountOptionsBottomSheet: ({ isVisible }: any) =>
        isVisible ? <div data-testid='account-options-sheet' /> : null,
}))

describe('AccountOverview', () => {
    const mockAccount = { address: 'addr' } as WalletAccount

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders balance values', () => {
        render(
            <AccountOverview
                account={mockAccount}
                chartVisible={true}
            />,
        )
        // Primary ALGO value and secondary preferred currency value
        expect(screen.getByTestId('currency-display')).toBeTruthy()
        expect(screen.getByTestId('preferred-currency-display')).toBeTruthy()
        expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
    })

    it('toggles privacy mode on press', async () => {
        const { useSettings } = await import('@perawallet/wallet-core-settings')
        const setPrivacyMode = vi.fn()
        vi.mocked(useSettings).mockReturnValue({
            privacyMode: false,
            setPrivacyMode,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        render(
            <AccountOverview
                account={mockAccount}
                chartVisible={true}
            />,
        )
        fireEvent.click(screen.getByTestId('currency-display'))

        expect(setPrivacyMode).toHaveBeenCalledWith(true)
    })

    describe('when account has no balance', () => {
        beforeEach(async () => {
            const { useAccountBalancesQuery } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(useAccountBalancesQuery).mockReturnValue({
                portfolioAlgoValue: new Decimal('0'),
                isPending: false,
                accountBalances: new Map(),
                isFetched: true,
                isRefetching: false,
                isError: false,
            })
        })

        it('renders "no balance" view', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            expect(
                screen.getByText('account_details.no_balance.welcome'),
            ).toBeTruthy()
        })

        it('navigates to Fund screen when Buy Algo is pressed', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            fireEvent.click(screen.getByText('Buy Algo'))
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Fund',
            })
        })

        it('opens Receive Funds sheet when Receive is pressed', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            fireEvent.click(screen.getByText('Receive'))
            expect(screen.getByTestId('receive-funds-sheet')).toBeTruthy()
        })

        it('opens account options sheet when More is pressed', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            fireEvent.click(screen.getByText('More'))
            expect(screen.getByTestId('account-options-sheet')).toBeTruthy()
        })
    })

    it('calls onSwipeEnabledChange with true on initial render', () => {
        const onSwipeEnabledChange = vi.fn()
        render(
            <AccountOverview
                account={mockAccount}
                chartVisible={true}
                onSwipeEnabledChange={onSwipeEnabledChange}
            />,
        )
        expect(onSwipeEnabledChange).toHaveBeenCalledWith(true)
    })

    it('does not throw when onSwipeEnabledChange is not provided', () => {
        expect(() =>
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            ),
        ).not.toThrow()
    })

    describe('when account is a watch account', () => {
        beforeEach(async () => {
            const { isWatchAccount } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(isWatchAccount).mockReturnValue(true)
        })

        it('renders WatchAccountButtonPanel instead of ButtonPanel when has balance', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            expect(screen.getByText('Copy Address')).toBeTruthy()
            expect(screen.getByText('Show QR')).toBeTruthy()
            expect(screen.queryByText('Receive')).toBeNull()
        })

        it('renders WatchAccountButtonPanel instead of NoFundsButtonPanel when no balance', async () => {
            const { useAccountBalancesQuery } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(useAccountBalancesQuery).mockReturnValue({
                portfolioAlgoValue: new Decimal('0'),
                isPending: false,
                accountBalances: new Map(),
                isFetched: true,
                isRefetching: false,
                isError: false,
            })

            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            expect(screen.getByText('Copy Address')).toBeTruthy()
            expect(screen.getByText('Show QR')).toBeTruthy()
            expect(
                screen.queryByText('account_details.no_balance.welcome'),
            ).toBeNull()
            expect(screen.queryByText('Buy Algo')).toBeNull()
        })

        it('does not show welcome text for watch accounts with no balance', async () => {
            const { useAccountBalancesQuery } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(useAccountBalancesQuery).mockReturnValue({
                portfolioAlgoValue: new Decimal('0'),
                isPending: false,
                accountBalances: new Map(),
                isFetched: true,
                isRefetching: false,
                isError: false,
            })

            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            expect(
                screen.queryByText('account_details.no_balance.get_started'),
            ).toBeNull()
        })

        it('opens account options sheet when More is pressed', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            fireEvent.click(screen.getByText('More'))
            expect(screen.getByTestId('account-options-sheet')).toBeTruthy()
        })

        it('opens receive funds sheet when Show QR is pressed', () => {
            render(
                <AccountOverview
                    account={mockAccount}
                    chartVisible={true}
                />,
            )
            fireEvent.click(screen.getByText('Show QR'))
            expect(screen.getByTestId('receive-funds-sheet')).toBeTruthy()
        })
    })
})
