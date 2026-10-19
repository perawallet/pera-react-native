/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, render, screen } from '@test-utils/render'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { AssetGroupItem } from '../../../utils/groupedHoldings'
import { AssetGroupRow } from '../AssetGroupRow'

type Holding = { scope: ChainScope; assetId: string }

const asset = { assetId: '31566704', name: 'USD Coin' } as PeraAsset

const groupItem = (chainIds: ChainId[]): AssetGroupItem<Holding> => {
    const members = chainIds.map(chainId => ({
        holding: { scope: { chainId, networkId: 'mainnet' }, assetId: chainId },
        asset,
        displayAmount: new Decimal(1),
        usdPrice: new Decimal(1),
    }))
    return {
        kind: 'group',
        group: {
            id: 'usdc',
            name: 'USD Coin',
            symbol: 'USDC',
            logoUrl: null,
            members: [],
        },
        members,
        amount: new Decimal(chainIds.length),
        largestMember: members[0]!.holding,
        isExpanded: false,
    }
}

// Only two chains are registered today; the stack has to cope with more.
const FUTURE_CHAINS = ['base', 'polygon'] as string[] as ChainId[]

const convertFiat = () => ({ displayCurrency: 'USD', value: new Decimal(1) })

describe('AssetGroupRow', () => {
    it("shows the group's name and the networks it spans", () => {
        render(
            <AssetGroupRow
                item={groupItem(['algorand', 'ethereum'])}
                convertFiat={convertFiat}
                onToggleExpanded={vi.fn()}
            />,
        )

        expect(screen.getByText('USD Coin')).toBeTruthy()
        expect(screen.getByTestId('network_icon_algorand')).toBeTruthy()
        expect(screen.getByTestId('network_icon_ethereum')).toBeTruthy()
    })

    it('toggles from anywhere on the row when it has no press action', () => {
        const onToggleExpanded = vi.fn()
        render(
            <AssetGroupRow
                item={groupItem(['algorand', 'ethereum'])}
                convertFiat={convertFiat}
                onToggleExpanded={onToggleExpanded}
            />,
        )

        fireEvent.click(screen.getByTestId('asset_group_row_usdc'))

        expect(onToggleExpanded).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('asset_group_toggle_usdc')).toBeNull()
    })

    it('opens from the row and toggles from "See networks" when it has a press action', () => {
        const onPress = vi.fn()
        const onToggleExpanded = vi.fn()
        render(
            <AssetGroupRow
                item={groupItem(['algorand', 'ethereum'])}
                convertFiat={convertFiat}
                onPress={onPress}
                onToggleExpanded={onToggleExpanded}
            />,
        )

        fireEvent.click(screen.getByTestId('asset_group_toggle_usdc'))
        expect(onToggleExpanded).toHaveBeenCalledTimes(1)
        expect(onPress).not.toHaveBeenCalled()

        fireEvent.click(screen.getByTestId('asset_group_row_usdc'))
        expect(onPress).toHaveBeenCalledTimes(1)
        expect(onToggleExpanded).toHaveBeenCalledTimes(1)
    })

    it('shows three network icons, then a count of the rest', () => {
        render(
            <AssetGroupRow
                item={groupItem(['algorand', 'ethereum', ...FUTURE_CHAINS])}
                convertFiat={convertFiat}
                onToggleExpanded={vi.fn()}
            />,
        )

        expect(screen.queryByTestId('network_icon_polygon')).toBeNull()
        expect(screen.getByTestId('network_icon_stack_more').textContent).toBe(
            '+1',
        )
    })
})
