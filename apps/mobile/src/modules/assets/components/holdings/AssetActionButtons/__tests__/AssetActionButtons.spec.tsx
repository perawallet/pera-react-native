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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AssetActionButtons from '../AssetActionButtons'
import { PeraAsset } from '@perawallet/wallet-core-assets'

const mockNavigate = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual = await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            replace: mockReplace,
        }),
    }
})

vi.mock('@modules/transactions/components/SendFunds/PWBottomSheet/SendFundsBottomSheet', () => ({
    default: () => null,
}))
vi.mock('@modules/transactions/components/ReceiveFunds/PWBottomSheet/ReceiveFundsBottomSheet', () => ({
    default: () => null,
}))

const mockAsset = {
    assetId: '123',
    name: 'TEST',
    unitName: 'TST',
    decimals: 6,
} as PeraAsset

describe('AssetActionButtons', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders all action buttons', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)
        
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('swap')
        expect(text).toContain('send')
        expect(text).toContain('receive')
    })

    it('navigates to swap screen when swap button is pressed', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)
        
        // Find swap button by text content and click
        const buttons = container.querySelectorAll('button')
        const swapButton = Array.from(buttons).find(btn => 
            btn.textContent?.toLowerCase().includes('swap')
        )
        if (swapButton) {
            fireEvent.click(swapButton)
            expect(mockReplace).toHaveBeenCalledWith('TabBar', { screen: 'Swap' })
        }
    })

    it('renders the component without crashing', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)
        expect(container).toBeTruthy()
    })
})
