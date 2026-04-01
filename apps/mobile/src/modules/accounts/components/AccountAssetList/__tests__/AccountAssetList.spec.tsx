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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AccountAssetList } from '../AccountAssetList'
import {
    WalletAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'

const mockAccount = {
    address: 'test-address',
    name: 'Test Account',
} as WalletAccount

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map(),
            isPending: false,
        })),
        isWatchAccount: vi.fn(() => false),
    }
})

vi.mock('@shopify/flash-list', () => ({
    FlashList: ({
        ListHeaderComponent,
        ListEmptyComponent,
    }: {
        ListHeaderComponent?: React.ReactNode
        ListEmptyComponent?: React.ReactNode
    }) => (
        <div data-testid='flash-list'>
            {ListHeaderComponent}
            {ListEmptyComponent}
        </div>
    ),
}))

vi.mock('@perawallet/wallet-core-assets', async () => ({
    useAssetsQuery: vi.fn(() => ({ data: new Map() })),
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        Number(value) / Math.pow(10, asset.decimals),
    ALGO_ASSET: { decimals: 6, unitName: 'ALGO' },
    ALGO_ASSET_ID: '0',
    AssetSortModes: {
        balanceDesc: 'balanceDesc',
        balanceAsc: 'balanceAsc',
        alphabeticalAsc: 'alphabeticalAsc',
        alphabeticalDesc: 'alphabeticalDesc',
    },
    useAssetPreferencesStore: vi.fn((selector: (state: unknown) => unknown) =>
        selector({
            assetSortMode: 'balanceDesc',
            hideZeroBalance: false,
            setAssetSortMode: vi.fn(),
            setHideZeroBalance: vi.fn(),
        }),
    ),
    useAssetPricesQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
    }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        algoUsdPrice: new Decimal(0),
        usdToPreferred: vi.fn(() => new Decimal(0)),
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: undefined,
        isPending: false,
    })),
}))

describe('AccountAssetList', () => {
    it('renders correctly', () => {
        const { container } = render(<AccountAssetList account={mockAccount} />)
        expect(container).toBeTruthy()
    })

    it('renders empty state when no assets are present', () => {
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: new Map([['test-address', { assetBalances: [] }]]),
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesQuery>)

        const { container } = render(<AccountAssetList account={mockAccount} />)
        expect(container).toBeTruthy()
    })

    it('renders loading state when isPending is true', () => {
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: new Map(),
            isPending: true,
        } as ReturnType<typeof useAccountBalancesQuery>)

        const { container } = render(<AccountAssetList account={mockAccount} />)
        expect(container).toBeTruthy()
    })

    it('respects scrollEnabled prop', () => {
        const { container } = render(
            <AccountAssetList
                account={mockAccount}
                scrollEnabled={false}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders asset list with balance data', () => {
        const mockBalances = new Map([
            [
                'test-address',
                {
                    assetBalances: [
                        {
                            assetId: '0',
                            amount: new Decimal('1000000'),
                            algoValue: new Decimal('1000000'),
                        },
                        {
                            assetId: '123',
                            amount: new Decimal('500'),
                            algoValue: new Decimal('500'),
                        },
                    ],
                },
            ],
        ])
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: mockBalances,
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesQuery>)

        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([
                ['0', { name: 'Algo', unitName: 'ALGO' }],
                ['123', { name: 'Test Token', unitName: 'TST' }],
            ]),
        } as unknown as ReturnType<typeof useAssetsQuery>)

        const { container } = render(<AccountAssetList account={mockAccount} />)
        expect(container).toBeTruthy()
    })

    it('renders header content when header prop is provided', () => {
        const { getByText } = render(
            <AccountAssetList
                account={mockAccount}
                header={<div>Header Content</div>}
            />,
        )
        expect(getByText('Header Content')).toBeTruthy()
    })

    it('renders Add Asset button for non-watch accounts', () => {
        const { container } = render(<AccountAssetList account={mockAccount} />)
        const text = container.textContent || ''
        expect(text).toContain('account_details.assets.add_asset')
    })

    describe('when account is a watch account', () => {
        beforeEach(async () => {
            const { isWatchAccount } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(isWatchAccount).mockReturnValue(true)
        })

        it('hides Add Asset button for watch accounts', () => {
            const { container } = render(
                <AccountAssetList account={mockAccount} />,
            )
            const text = container.textContent || ''
            expect(text).not.toContain('account_details.assets.add_asset')
        })

        it('still renders asset title for watch accounts', () => {
            render(<AccountAssetList account={mockAccount} />)
            expect(
                screen.getByText('account_details.assets.title'),
            ).toBeTruthy()
        })

        it('still renders search input for watch accounts', () => {
            const { container } = render(
                <AccountAssetList account={mockAccount} />,
            )
            expect(container).toBeTruthy()
        })
    })
})
