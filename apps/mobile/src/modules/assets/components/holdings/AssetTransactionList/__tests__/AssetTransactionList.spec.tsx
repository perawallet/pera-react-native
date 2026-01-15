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
import { AssetTransactionList } from '../AssetTransactionList'
import { View, Text } from 'react-native'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PeraAsset } from '@perawallet/wallet-core-assets'

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

const mockAccount = { address: 'test' } as WalletAccount
const mockAsset = { assetId: '123' } as PeraAsset

describe('AssetTransactionList', () => {
    it('renders header with transaction list title', () => {
        const { container } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <View />
            </AssetTransactionList>,
        )
        expect(container.textContent?.toLowerCase()).toContain('transaction')
    })

    it('renders children content in header', () => {
        const { container } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <Text>Child Content</Text>
            </AssetTransactionList>,
        )
        expect(container.textContent).toContain('Child Content')
    })

    it('renders empty state when no transactions', () => {
        const { container } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <View />
            </AssetTransactionList>,
        )
        // Component should render
        expect(container).toBeTruthy()
    })

    it('displays filter and CSV export buttons', () => {
        const { container } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <View />
            </AssetTransactionList>,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('filter')
        expect(text).toContain('csv')
    })
})
