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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssetSelectionScreen } from '../AssetSelectionScreen'
import { useSendFunds } from '@modules/transactions/hooks'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import type { AccountAssetSelectionListProps } from '@modules/assets/components/AccountAssetSelectionList'

const mockNavigate = vi.fn()
const mockSetSelectedAssetId = vi.fn()

let capturedOnAssetSelected: ((asset: AssetWithAccountBalance) => void) | null =
    null

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

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@modules/assets/components/AccountAssetSelectionList', () => ({
    AccountAssetSelectionList: (props: AccountAssetSelectionListProps) => {
        capturedOnAssetSelected = props.onAssetSelected
        return <div data-testid='account-asset-selection-list' />
    },
}))

describe('AssetSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedOnAssetSelected = null
        ;(useSendFunds as ReturnType<typeof vi.fn>).mockReturnValue({
            setSelectedAssetId: mockSetSelectedAssetId,
        })
    })

    it('renders AccountAssetSelectionList', () => {
        render(<AssetSelectionScreen />)

        expect(screen.getByTestId('account-asset-selection-list')).toBeTruthy()
    })

    it('calls setSelectedAssetId and navigates to InputAmount when an asset is selected', () => {
        const mockAsset = { assetId: '123' } as AssetWithAccountBalance

        render(<AssetSelectionScreen />)

        capturedOnAssetSelected!(mockAsset)

        expect(mockSetSelectedAssetId).toHaveBeenCalledWith('123')
        expect(mockNavigate).toHaveBeenCalledWith('InputAmount')
    })

    it('renders without error when useSendFunds returns default state', () => {
        const { container } = render(<AssetSelectionScreen />)

        expect(container).toBeTruthy()
    })
})
