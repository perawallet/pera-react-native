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
import type { TopPairItem } from '@perawallet/wallet-core-swaps'
import { SwapTopPairs } from '../SwapTopPairs'

const setFromAsset = vi.fn()
const setToAsset = vi.fn()
const logEvent = vi.fn()
const useTopPairsQueryMock = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({ setFromAsset, setToAsset }),
    useTopPairsQuery: (...args: unknown[]) => useTopPairsQueryMock(...args),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    PeraWalletProvider: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
    ),
    usePeraProvider: () => ({
        analytics: { logEvent },
        deviceInfo: { getDeviceLocale: () => 'en-US' },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatCurrency: (value: unknown) => `$${String(value)}`,
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'USD',
        usdToPreferred: (value: unknown) => value,
    }),
}))

vi.mock('@modules/assets/components', () => ({
    AssetIcon: ({ asset }: { asset: { assetId: string } }) => (
        <span data-testid={`asset-icon-${asset.assetId}`} />
    ),
}))

vi.mock('@modules/swap/components/SwapAssetPairIcon', () => ({
    SwapAssetPairIcon: ({
        assetIn,
        assetOut,
    }: {
        assetIn: { assetId: string }
        assetOut: { assetId: string }
    }) => (
        <span
            data-testid={`swap-asset-pair-icon-${assetIn.assetId}-${assetOut.assetId}`}
        />
    ),
}))

vi.mock('@components/core', () => ({
    PWView: ({
        children,
        testID,
    }: {
        children?: React.ReactNode
        testID?: string
    }) => <div data-testid={testID}>{children}</div>,
    PWText: ({ children }: { children?: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWTouchableOpacity: ({
        children,
        onPress,
        testID,
    }: {
        children?: React.ReactNode
        onPress?: () => void
        testID?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {children}
        </button>
    ),
}))

const createPair = (idA: string, idB: string, volume: string): TopPairItem => ({
    assetA: {
        assetId: idA,
        unitName: `A${idA}`,
        name: `AssetA-${idA}`,
        verificationTier: 'verified',
    },
    assetB: {
        assetId: idB,
        unitName: `B${idB}`,
        name: `AssetB-${idB}`,
        verificationTier: 'verified',
    },
    volume24hUsd: volume,
})

describe('SwapTopPairs', () => {
    beforeEach(() => {
        setFromAsset.mockReset()
        setToAsset.mockReset()
        logEvent.mockReset()
        useTopPairsQueryMock.mockReset()
    })

    it('renders skeleton rows while loading', () => {
        useTopPairsQueryMock.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        })

        render(<SwapTopPairs />)

        expect(screen.getByTestId('swap-top-pairs-skeleton-0')).toBeDefined()
        expect(screen.getByTestId('swap-top-pairs-skeleton-4')).toBeDefined()
    })

    it('renders an error message on failure', () => {
        useTopPairsQueryMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        })

        render(<SwapTopPairs />)

        expect(screen.getByText('swap.top_pairs.error')).toBeDefined()
    })

    it('renders nothing when there are no pairs', () => {
        useTopPairsQueryMock.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
        })

        render(<SwapTopPairs />)

        expect(screen.queryByTestId('swap-top-pairs')).toBeNull()
    })

    it('renders a row for each returned pair', () => {
        useTopPairsQueryMock.mockReturnValue({
            data: [
                createPair('0', '31566704', '1000000'),
                createPair('10', '20', '500000'),
            ],
            isLoading: false,
            isError: false,
        })

        render(<SwapTopPairs />)

        expect(screen.getByTestId('swap-top-pair-1')).toBeDefined()
        expect(screen.getByTestId('swap-top-pair-2')).toBeDefined()
        expect(screen.getByText(/A0 to B31566704/)).toBeDefined()
    })

    it('prefills the swap form and logs analytics on tap', () => {
        const pair = createPair('0', '31566704', '1000000')
        useTopPairsQueryMock.mockReturnValue({
            data: [pair],
            isLoading: false,
            isError: false,
        })

        render(<SwapTopPairs />)

        fireEvent.click(screen.getByTestId('swap-top-pair-1'))

        expect(setFromAsset).toHaveBeenCalledWith('0')
        expect(setToAsset).toHaveBeenCalledWith('31566704')
        expect(logEvent).toHaveBeenCalledWith('swap_top_pair_selected', {
            assetIn: 'A0',
            assetOut: 'B31566704',
        })
    })
})
