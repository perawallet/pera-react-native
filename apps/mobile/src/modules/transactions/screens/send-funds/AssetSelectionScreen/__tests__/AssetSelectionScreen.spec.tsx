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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AssetSelectionScreen } from '../AssetSelectionScreen'
import {
    useSelectedAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
        }),
    }
})

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWFlatList: ({ data, renderItem, ListEmptyComponent }: any) => (
        <div data-testid='flat-list'>
            {data && data.length > 0
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data.map((item: any, index: number) =>
                      renderItem({ item, index }),
                  )
                : ListEmptyComponent}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress, ...rest }: any) => (
        <div
            onClick={onPress}
            {...rest}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children }: any) => <div>{children}</div>,
    PWSkeleton: () => <div data-testid='skeleton' />,
}))

vi.mock('@components/LoadingView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LoadingView: ({ count }: any) => (
        <div>
            {Array.from({ length: count ?? 1 }, (_, i) => (
                <div
                    key={i}
                    data-testid='skeleton'
                />
            ))}
        </div>
    ),
}))

vi.mock('@modules/assets/components/AssetItem/AccountAssetItemView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountAssetItemView: ({ accountBalance }: any) => (
        <div data-testid={`asset-item-${accountBalance.assetId}`} />
    ),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountBalancesQuery: vi.fn(() => ({
        accountBalances: new Map(),
    })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

const mockSetSelectedAssetBalance = vi.fn()

const mockAssets = [
    { assetId: '0', amount: '1000000', algoValue: '1' },
    { assetId: '123', amount: '500', algoValue: '0.5' },
]

describe('AssetSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            setSelectedAssetBalance: mockSetSelectedAssetBalance,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectedAccount as any).mockReturnValue({
            address: 'test-address',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAccountBalancesQuery as any).mockReturnValue({
            accountBalances: new Map(),
        })
    })

    it('renders asset list when balanceData is available', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAccountBalancesQuery as any).mockReturnValue({
            accountBalances: new Map([
                ['test-address', { assetBalances: mockAssets }],
            ]),
        })

        render(<AssetSelectionScreen />)

        expect(screen.getByTestId('asset-item-0')).toBeTruthy()
        expect(screen.getByTestId('asset-item-123')).toBeTruthy()
    })

    it('shows loading skeletons when balanceData is empty', () => {
        render(<AssetSelectionScreen />)

        const skeletons = screen.getAllByTestId('skeleton')
        expect(skeletons.length).toBe(3)
    })

    it('calls setSelectedAsset and navigates to InputAmount when an asset is pressed', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAccountBalancesQuery as any).mockReturnValue({
            accountBalances: new Map([
                ['test-address', { assetBalances: mockAssets }],
            ]),
        })

        render(<AssetSelectionScreen />)

        fireEvent.click(screen.getByTestId('asset-item-0'))

        expect(mockSetSelectedAssetBalance).toHaveBeenCalledWith(mockAssets[0])
        expect(mockNavigate).toHaveBeenCalledWith('InputAmount')
    })

    it('renders without error when selectedAccount is null', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectedAccount as any).mockReturnValue(null)

        const { container } = render(<AssetSelectionScreen />)

        expect(container).toBeTruthy()
        const skeletons = screen.getAllByTestId('skeleton')
        expect(skeletons.length).toBe(3)
    })
})
