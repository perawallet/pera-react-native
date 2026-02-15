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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@test-utils/render'
import { SendFundsBottomSheet } from '../SendFundsBottomSheet'
import { useAccountAssetBalanceQuery } from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'

const mockSetSelectedAsset = vi.fn()
const mockSetCanSelectAsset = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: ({ children, isVisible }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style, ...rest }: any) => (
        <div
            style={style}
            {...rest}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWFlatList: ({ data, renderItem, ...rest }: any) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <div {...rest}>{data?.map((item: any) => renderItem({ item }))}</div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWHeader: ({ children, title }: any) => (
        <div>
            {title}
            {children}
        </div>
    ),
    PWSkeleton: () => <div data-testid='skeleton' />,
}))

vi.mock('@react-navigation/native', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NavigationContainer: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NavigationIndependentTree: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../../../routes/send-funds', () => ({
    SendFundsRoutes: () => <div data-testid='send-funds-routes' />,
}))

vi.mock(
    '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TransactionErrorBoundary: ({ children }: any) => (
            <div data-testid='error-boundary'>{children}</div>
        ),
    }),
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({ address: 'test-address' })),
    useAccountAssetBalanceQuery: vi.fn(),
    useAccountBalancesQuery: vi.fn(() => ({
        accountBalances: new Map(),
    })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        useWindowDimensions: () => ({ width: 375, height: 812 }),
    }
})

describe('SendFundsBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: true,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAsset: undefined,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAccountAssetBalanceQuery as any).mockReturnValue({
            data: { assetId: '123' },
        })
    })

    it('does not update store when isVisible is false', () => {
        render(
            <SendFundsBottomSheet
                isVisible={false}
                onClose={mockOnClose}
                assetId='123'
            />,
        )

        expect(mockSetSelectedAsset).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('updates store when isVisible is true and assetId is provided', () => {
        render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
                assetId='123'
            />,
        )

        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetSelectedAsset).toHaveBeenCalledWith({ assetId: '123' })
    })

    it('does not call setSelectedAsset if asset is already selected', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: false,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAsset: { assetId: '123' },
        })

        render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
                assetId='123'
            />,
        )

        expect(mockSetSelectedAsset).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('updates store if assetId changes even if already not selectable', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            canSelectAsset: false,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAsset: { assetId: '123' },
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAccountAssetBalanceQuery as any).mockReturnValue({
            data: { assetId: '456' },
        })

        render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
                assetId='456'
            />,
        )

        expect(mockSetSelectedAsset).toHaveBeenCalledWith({ assetId: '456' })
        // canSelectAsset is already false, so setCanSelectAsset shouldn't be called again
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })
})
