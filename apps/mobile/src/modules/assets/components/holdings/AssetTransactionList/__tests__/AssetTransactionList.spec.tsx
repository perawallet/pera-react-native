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

import React from 'react'
import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AssetTransactionList } from '../AssetTransactionList'
import { View, Text } from 'react-native'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PeraAsset } from '@perawallet/wallet-core-assets'

vi.mock('@legendapp/list', () => ({
    LegendList: ({
        ListHeaderComponent,
        ListEmptyComponent,
        children,
    }: {
        ListHeaderComponent?: React.ReactNode | (() => React.ReactElement)
        ListEmptyComponent?: React.ReactNode | (() => React.ReactElement)
        children?: React.ReactNode
    }) => {
        return React.createElement(
            'div',
            { 'data-testid': 'legend-list' },
            typeof ListHeaderComponent === 'function'
                ? React.createElement(ListHeaderComponent)
                : ListHeaderComponent,
            typeof ListEmptyComponent === 'function'
                ? React.createElement(ListEmptyComponent)
                : ListEmptyComponent,
            children,
        )
    },
}))

const mockAccount = { address: 'test' } as WalletAccount
const mockAsset = { assetId: '123' } as PeraAsset

describe('AssetTransactionList', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <View />
            </AssetTransactionList>,
        )
        // Component should render without throwing
        expect(container).toBeTruthy()
    })

    it('renders children content', () => {
        const { getByText } = render(
            <AssetTransactionList
                account={mockAccount}
                asset={mockAsset}
            >
                <Text>Child Content</Text>
            </AssetTransactionList>,
        )
        // Children should be rendered
        expect(getByText('Child Content')).toBeTruthy()
    })
})
