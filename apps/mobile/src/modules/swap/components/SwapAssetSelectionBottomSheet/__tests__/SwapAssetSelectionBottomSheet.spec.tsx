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
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SwapAssetSelectionBottomSheet } from '../SwapAssetSelectionBottomSheet'

const mockUseSelectedAccount = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: mockUseSelectedAccount,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

vi.mock('@components/core', async () => {
    return {
        PWBottomSheet: ({
            children,
            isVisible,
        }: {
            children: React.ReactNode
            isVisible: boolean
        }) =>
            isVisible ? (
                <div data-testid='PWBottomSheet'>{children}</div>
            ) : null,
        PWToolbar: () => <div data-testid='PWToolbar' />,
        PWIcon: () => <div data-testid='PWIcon' />,
        PWText: ({ children }: { children: React.ReactNode }) => (
            <span>{children}</span>
        ),
        PWView: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        PWFlatList: ({
            data,
            renderItem,
        }: {
            data: { assetId: string }[]
            renderItem: ({
                item,
            }: {
                item: { assetId: string }
            }) => React.ReactNode
        }) => (
            <div data-testid='asset-list'>
                {data?.map((item: { assetId: string }) => (
                    <div key={item.assetId}>{renderItem({ item })}</div>
                ))}
            </div>
        ),
        PWTouchableOpacity: ({
            children,
            onPress,
        }: {
            children: React.ReactNode
            onPress: () => void
        }) => (
            <button
                data-testid='asset-item'
                onClick={onPress}
            >
                {children}
            </button>
        ),
    }
})

vi.mock('@modules/assets/components/AssetItem/AccountAssetItemView', () => ({
    AccountAssetItemView: ({
        accountBalance,
    }: {
        accountBalance: { assetId: string }
    }) => <div data-testid={`asset-${accountBalance.assetId}`} />,
}))

vi.mock('@components/LoadingView', () => ({
    LoadingView: () => <div data-testid='loading-view' />,
}))

const mockAssetBalances = [
    { assetId: '0', amount: '1000000' },
    { assetId: '123', amount: '500' },
]

describe('SwapAssetSelectionBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSelectedAccount.mockReturnValue({
            address: 'TEST_ADDRESS',
        })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                ['TEST_ADDRESS', { assetBalances: mockAssetBalances }],
            ]),
        })
    })

    it('renders asset list when visible', () => {
        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={vi.fn()}
                onAssetSelected={vi.fn()}
            />,
        )

        expect(screen.getByTestId('asset-list')).toBeTruthy()
        expect(screen.getByTestId('asset-0')).toBeTruthy()
        expect(screen.getByTestId('asset-123')).toBeTruthy()
    })

    it('does not render when not visible', () => {
        render(
            <SwapAssetSelectionBottomSheet
                isVisible={false}
                onClose={vi.fn()}
                onAssetSelected={vi.fn()}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('calls onAssetSelected and onClose when an asset is tapped', () => {
        const onAssetSelected = vi.fn()
        const onClose = vi.fn()

        render(
            <SwapAssetSelectionBottomSheet
                isVisible={true}
                onClose={onClose}
                onAssetSelected={onAssetSelected}
            />,
        )

        const assetItems = screen.getAllByTestId('asset-item')
        fireEvent.click(assetItems[0])

        expect(onAssetSelected).toHaveBeenCalledWith(mockAssetBalances[0])
        expect(onClose).toHaveBeenCalled()
    })
})
