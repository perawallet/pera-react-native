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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import AssetHoldings from '../AssetHoldings'
import { mockedAsset } from '@perawallet/wallet-core-assets'
import { mockedWalletAccount } from '@perawallet/wallet-core-accounts'

const mockAsset: any = {
    assetId: 123,
    name: 'TEST',
    unitName: 'TST',
    decimals: 6,
}
const mockAccount: any = {
    address: 'test-address',
}

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountAssetBalanceQuery: vi.fn(() => ({
            data: { amount: 100 },
            isPending: false,
        })),
    }
})

// Mock complex children
vi.mock('../AssetTransactionList/AssetTransactionList', () => ({
    default: 'AssetTransactionList',
}))
vi.mock('../AssetWealthChart/AssetWealthChart', () => ({
    default: 'AssetWealthChart',
}))
vi.mock('../AssetActionButtons/AssetActionButtons', () => ({
    default: 'AssetActionButtons',
}))

describe('AssetHoldings', () => {
    it('renders correctly', () => {
        render(
            <AssetHoldings
                account={mockAccount}
                asset={mockAsset}
            />,
        )
        expect(screen.toJSON()).toBeDefined()
    })
})
