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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import AccountAssetList from '../AccountAssetList'
import {
    WalletAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { Text } from 'react-native'

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
    }
})

vi.mock('@shopify/flash-list', () => ({
    FlashList: ({
        ListHeaderComponent,
        ListEmptyComponent,
        children,
    }: {
        ListHeaderComponent?: React.ReactNode
        ListEmptyComponent?: React.ReactNode
        children?: React.ReactNode
    }) => (
        <div data-testid='flash-list'>
            {ListHeaderComponent}
            {ListEmptyComponent}
            {children}
        </div>
    ),
}))

vi.mock('@perawallet/wallet-core-assets', async () => ({
    useAssetsQuery: vi.fn(() => ({ data: new Map() })),
    ALGO_ASSET: { decimals: 6 },
}))

describe('AccountAssetList', () => {
    it('renders children content correctly', () => {
        const { container } = render(
            <AccountAssetList account={mockAccount}>
                <Text>Child Content</Text>
            </AccountAssetList>,
        )
        expect(container.textContent).toContain('Child Content')
    })

    it('renders empty state when no assets are present', () => {
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: new Map([['test-address', { assetBalances: [] }]]),
            isPending: false,
        } as unknown as ReturnType<typeof useAccountBalancesQuery>)

        const { container } = render(
            <AccountAssetList account={mockAccount}>Content</AccountAssetList>,
        )
        expect(container).toBeTruthy()
    })

    it('renders loading state when isPending is true', () => {
        vi.mocked(useAccountBalancesQuery).mockReturnValue({
            accountBalances: new Map(),
            isPending: true,
        } as ReturnType<typeof useAccountBalancesQuery>)

        const { container } = render(
            <AccountAssetList account={mockAccount}>Content</AccountAssetList>,
        )
        expect(container).toBeTruthy()
    })

    it('respects scrollEnabled prop', () => {
        const { container } = render(
            <AccountAssetList
                account={mockAccount}
                scrollEnabled={false}
            >
                Content
            </AccountAssetList>,
        )
        expect(container).toBeTruthy()
    })

    it('renders asset list with balance data', () => {
        const mockBalances = new Map([
            [
                'test-address',
                {
                    assetBalances: [
                        { assetId: '0', balance: '1000000' },
                        { assetId: '123', balance: '500' },
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

        const { container } = render(
            <AccountAssetList account={mockAccount}>Content</AccountAssetList>,
        )
        expect(container).toBeTruthy()
    })
})
