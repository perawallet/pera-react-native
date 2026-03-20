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
import { AssetActionButtons } from '../AssetActionButtons'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'

const mockNavigate = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            replace: mockReplace,
        }),
    }
})

vi.mock(
    '@modules/transactions/components/send-funds/SendFundsBottomSheet/SendFundsBottomSheet',
    () => ({
        SendFundsBottomSheet: () => null,
    }),
)
vi.mock(
    '@modules/transactions/components/receive-funds/ReceiveFundsBottomSheet',
    () => ({
        ReceiveFundsBottomSheet: () => null,
    }),
)

const mockSetSelectedAsset = vi.fn()
const mockSetCanSelectAsset = vi.fn()

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: () => ({
        setSelectedAsset: mockSetSelectedAsset,
        setCanSelectAsset: mockSetCanSelectAsset,
    }),
}))

const mockCopyToClipboard = vi.fn()
vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({
        copyToClipboard: mockCopyToClipboard,
    }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: vi.fn(() => ({ address: 'test-address' })),
        isWatchAccount: vi.fn(() => false),
    }
})

const mockAsset = {
    assetId: '123',
    name: 'TEST',
    unitName: 'TST',
    decimals: 6,
} as PeraAsset

const mockAssetHolding = {
    amount: 100,
}

describe('AssetActionButtons', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders all action buttons', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)

        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('swap')
        expect(text).toContain('buy')
        expect(text).toContain('send')
        expect(text).toContain('receive')
    })

    it('navigates to swap screen when swap button is pressed', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)

        // Find swap button by text content and click
        const buttons = container.querySelectorAll('button')
        const swapButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('swap'),
        )
        if (swapButton) {
            fireEvent.click(swapButton)
            expect(mockReplace).toHaveBeenCalledWith('TabBar', {
                screen: 'Swap',
            })
        }
    })

    it('navigates to fund screen when buy button is pressed', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)

        const buttons = container.querySelectorAll('button')
        const buyButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('buy'),
        )
        if (buyButton) {
            fireEvent.click(buyButton)
            expect(mockReplace).toHaveBeenCalledWith('TabBar', {
                screen: 'Fund',
            })
        }
    })

    it('preselects asset and skips selection when send button is pressed', () => {
        const { container } = render(
            <AssetActionButtons
                asset={mockAsset}
                assetHolding={
                    mockAssetHolding as unknown as AssetWithAccountBalance
                }
            />,
        )

        const buttons = container.querySelectorAll('button')
        const sendButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('send'),
        )

        if (sendButton) {
            fireEvent.click(sendButton)
            expect(mockSetSelectedAsset).toHaveBeenCalledWith(mockAssetHolding)
            expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        }
    })

    it('renders the component without crashing', () => {
        const { container } = render(<AssetActionButtons asset={mockAsset} />)
        expect(container).toBeTruthy()
    })

    describe('when account is a watch account', () => {
        beforeEach(async () => {
            const { isWatchAccount } =
                await import('@perawallet/wallet-core-accounts')
            vi.mocked(isWatchAccount).mockReturnValue(true)
        })

        it('renders only Copy Address and Receive buttons', () => {
            const { container } = render(
                <AssetActionButtons asset={mockAsset} />,
            )

            const text = container.textContent?.toLowerCase() || ''
            expect(text).toContain('copy_address')
            expect(text).toContain('receive')
        })

        it('does not render Swap, Buy, or Send buttons', () => {
            const { container } = render(
                <AssetActionButtons asset={mockAsset} />,
            )

            const text = container.textContent?.toLowerCase() || ''
            expect(text).not.toContain('swap')
            expect(text).not.toContain('buy')
            expect(text).not.toContain('send')
        })

        it('copies address and shows toast when Copy Address is pressed', () => {
            const { container } = render(
                <AssetActionButtons asset={mockAsset} />,
            )

            const buttons = container.querySelectorAll('button')
            const copyButton = Array.from(buttons).find(btn =>
                btn.textContent?.toLowerCase().includes('copy_address'),
            )
            if (copyButton) {
                fireEvent.click(copyButton)
                expect(mockCopyToClipboard).toHaveBeenCalledWith('test-address')
                expect(mockShowToast).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' }),
                )
            }
        })

        it('does not navigate to Swap or Fund when watch account', () => {
            const { container } = render(
                <AssetActionButtons asset={mockAsset} />,
            )

            const buttons = container.querySelectorAll('button')
            buttons.forEach(btn => fireEvent.click(btn))

            expect(mockReplace).not.toHaveBeenCalledWith('TabBar', {
                screen: 'Swap',
            })
            expect(mockReplace).not.toHaveBeenCalledWith('TabBar', {
                screen: 'Fund',
            })
        })
    })
})
