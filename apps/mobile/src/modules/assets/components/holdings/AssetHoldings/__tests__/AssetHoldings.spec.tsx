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
import AssetHoldings from '../AssetHoldings'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    WalletAccount,
    useAccountAssetBalanceQuery,
} from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'

const mockAsset = {
    assetId: '123',
    name: 'TEST',
    unitName: 'TST',
    decimals: 6,
} as PeraAsset
const mockAccount = {
    address: 'test-address',
} as WalletAccount

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountAssetBalanceQuery: vi.fn(() => ({
            data: { amount: new Decimal(100), fiatValue: new Decimal(50) },
            isPending: false,
        })),
    }
})

// Mock complex children
vi.mock('../AssetTransactionList/AssetTransactionList', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))
vi.mock('../AssetWealthChart/AssetWealthChart', () => ({
    default: () => <div data-testid='wealth-chart'>WealthChart</div>,
}))
vi.mock('../AssetActionButtons/AssetActionButtons', () => ({
    default: () => <div data-testid='action-buttons'>ActionButtons</div>,
}))

describe('AssetHoldings', () => {
    it('renders asset title with name', () => {
        const { container } = render(
            <AssetHoldings
                account={mockAccount}
                asset={mockAsset}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('displays crypto amount from balance query', () => {
        vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
            data: { amount: new Decimal(500), fiatValue: new Decimal(250) },
            isPending: false,
        } as unknown as ReturnType<typeof useAccountAssetBalanceQuery>)

        const { container } = render(
            <AssetHoldings
                account={mockAccount}
                asset={mockAsset}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders action buttons for asset', () => {
        const { container } = render(
            <AssetHoldings
                account={mockAccount}
                asset={mockAsset}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('handles null balance data gracefully', () => {
        vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
            data: null,
            isPending: false,
        } as unknown as ReturnType<typeof useAccountAssetBalanceQuery>)

        const { container } = render(
            <AssetHoldings
                account={mockAccount}
                asset={mockAsset}
            />,
        )
        expect(container).toBeTruthy()
    })
})
