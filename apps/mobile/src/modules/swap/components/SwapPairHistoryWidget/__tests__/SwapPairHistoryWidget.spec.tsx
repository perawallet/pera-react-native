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

const mockSetFromAsset = vi.fn()
const mockSetToAsset = vi.fn()
const mockUseDistinctPairsHistoryQuery = vi.fn()
const mockSwapHistoryBottomSheet = vi.fn()

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useDistinctPairsHistoryQuery: (...args: unknown[]) =>
        mockUseDistinctPairsHistoryQuery(...args),
    useSwaps: () => ({
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'ADDRESS' }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: ({ asset }: { asset: { assetId: string } }) => (
        <span data-testid={`asset-icon-${asset.assetId}`} />
    ),
}))

vi.mock('@modules/swap/components/SwapHistoryBottomSheet', () => ({
    SwapHistoryBottomSheet: (props: {
        isVisible: boolean
        address: string
        onClose: () => void
    }) => {
        mockSwapHistoryBottomSheet(props)
        return props.isVisible ? (
            <span
                data-testid='swap-history-bottom-sheet'
                data-address={props.address}
            />
        ) : null
    },
}))

import { SwapPairHistoryWidget } from '../SwapPairHistoryWidget'

const makePair = (
    inId: string,
    outId: string,
    inName: string,
    outName: string,
) => ({
    assetIn: {
        assetId: inId,
        unitName: inName,
        decimals: 6,
        verificationTier: 'verified' as const,
    },
    assetOut: {
        assetId: outId,
        unitName: outName,
        decimals: 6,
        verificationTier: 'verified' as const,
    },
    swapDatetime: '2024-01-01T00:00:00Z',
    pairKey: `${inId}-${outId}`,
})

describe('SwapPairHistoryWidget', () => {
    beforeEach(() => {
        mockSetFromAsset.mockReset()
        mockSetToAsset.mockReset()
        mockUseDistinctPairsHistoryQuery.mockReset()
        mockSwapHistoryBottomSheet.mockReset()
    })

    it('renders nothing when pairs are empty and not loading', () => {
        mockUseDistinctPairsHistoryQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
        })

        render(<SwapPairHistoryWidget />)

        expect(screen.queryByTestId('swap-pair-history-widget')).toBeNull()
    })

    it('opens the history bottom sheet when "See all" is tapped', () => {
        mockUseDistinctPairsHistoryQuery.mockReturnValue({
            data: [makePair('0', '31566704', 'ALGO', 'USDC')],
            isLoading: false,
            isError: false,
        })

        render(<SwapPairHistoryWidget />)

        expect(screen.getByText('swap.history.widget.title')).toBeDefined()
        expect(screen.getByText('ALGO to USDC')).toBeDefined()
        expect(screen.queryByTestId('swap-history-bottom-sheet')).toBeNull()

        fireEvent.click(screen.getByTestId('swap-pair-history-see-all'))

        const sheet = screen.getByTestId('swap-history-bottom-sheet')
        expect(sheet.getAttribute('data-address')).toBe('ADDRESS')
    })

    it('prefills the form when a chip is tapped', () => {
        mockUseDistinctPairsHistoryQuery.mockReturnValue({
            data: [makePair('0', '31566704', 'ALGO', 'USDC')],
            isLoading: false,
            isError: false,
        })

        render(<SwapPairHistoryWidget />)

        fireEvent.click(screen.getByTestId('swap-pair-chip-0-31566704'))

        expect(mockSetFromAsset).toHaveBeenCalledWith('0')
        expect(mockSetToAsset).toHaveBeenCalledWith('31566704')
    })

    it('shows the error message when the query errored', () => {
        mockUseDistinctPairsHistoryQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        })

        render(<SwapPairHistoryWidget />)

        expect(screen.getByText('swap.history.widget.error')).toBeDefined()
    })
})
