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
import { render, fireEvent } from '@test-utils/render'
import { SelectDestinationScreen } from '../SelectDestinationScreen'
import { useSendFunds } from '@modules/transactions/hooks'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            goBack: mockGoBack,
        }),
    }
})

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@components/AddressSearchView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AddressSearchView: ({ onSelected, excludeAddress }: any) => (
        <div data-testid='address-search-view'>
            <span data-testid='exclude-address'>{excludeAddress}</span>
            <button
                data-testid='select-address-btn'
                onClick={() => onSelected('SELECTED_ADDRESS')}
            >
                Select
            </button>
        </div>
    ),
}))

vi.mock('@components/EmptyView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EmptyView: ({ title, body }: any) => (
        <div data-testid='empty-view'>
            <span data-testid='empty-title'>{title}</span>
            <span data-testid='empty-body'>{body}</span>
        </div>
    ),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: () => <div data-testid='asset-icon' />,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAccountInformationQuery: vi.fn(() => ({ data: null })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(),
    ALGO_ASSET_ID: '0',
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountsStore: vi.fn(() => []),
    useAccountBalancesQuery: vi.fn(() => ({
        accountBalances: new Map(),
    })),
    hasSigningKeys: vi.fn(() => false),
    canSignWithAccount: vi.fn(() => false),
}))

const mockSetDestination = vi.fn()
const mockSetSendMode = vi.fn()

const mockAsset = {
    id: 123,
    name: 'Test Asset',
    unitName: 'TST',
    decimals: 6,
}

describe('SelectDestinationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            selectedAsset: { assetId: 123 },
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAssetsQuery as any).mockReturnValue({
            data: new Map([[123, mockAsset]]),
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSelectedAccount as any).mockReturnValue({
            address: 'SENDER_ADDRESS',
        })
    })

    it('shows EmptyView when selectedAsset is missing', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFunds as any).mockReturnValue({
            selectedAsset: undefined,
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        const { getByTestId } = render(<SelectDestinationScreen />)

        expect(getByTestId('empty-view')).toBeTruthy()
        expect(getByTestId('empty-title').textContent).toBe(
            'send_funds.destination.error_title',
        )
        expect(getByTestId('empty-body').textContent).toBe(
            'send_funds.destination.error_body',
        )
    })

    it('shows EmptyView when asset is not found in assets map', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useAssetsQuery as any).mockReturnValue({
            data: new Map(),
        })

        const { getByTestId } = render(<SelectDestinationScreen />)

        expect(getByTestId('empty-view')).toBeTruthy()
    })

    it('renders AddressSearchView with correct excludeAddress', () => {
        const { getByTestId } = render(<SelectDestinationScreen />)

        expect(getByTestId('address-search-view')).toBeTruthy()
        expect(getByTestId('exclude-address').textContent).toBe(
            'SENDER_ADDRESS',
        )
    })

    it('calls setDestination and navigates to ARC59SendSummary for ASA send to external address', () => {
        const { getByTestId } = render(<SelectDestinationScreen />)

        fireEvent.click(getByTestId('select-address-btn'))

        expect(mockSetDestination).toHaveBeenCalledWith('SELECTED_ADDRESS')
        expect(mockSetSendMode).toHaveBeenCalledWith('arc59')
        expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
    })

    it('sets up header with asset name via useNavigationHeader', () => {
        render(<SelectDestinationScreen />)

        expect(useNavigationHeader).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.anything(),
            }),
        )
    })
})
