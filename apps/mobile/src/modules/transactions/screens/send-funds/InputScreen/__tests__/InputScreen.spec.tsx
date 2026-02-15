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
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { InputScreen } from '../InputScreen'
import { useInputScreen } from '../useInputScreen'
import Decimal from 'decimal.js'

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: vi.fn(),
        }),
    }
})

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: vi.fn(({ title, onPress, isDisabled }: any) => (
        <button
            onClick={onPress}
            data-disabled={isDisabled ? true : undefined}
        >
            {title}
        </button>
    )),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: vi.fn(({ children, isVisible }: any) =>
        isVisible ? (
            <div data-testid='max-exceeded-sheet'>{children}</div>
        ) : null,
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: vi.fn(({ children }: any) => <div>{children}</div>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: vi.fn(({ children }: any) => <span>{children}</span>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWHeader: vi.fn(({ children }: any) => <div>{children}</div>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWIcon: vi.fn(({ name }: any) => <div data-testid={`icon-${name}`} />),
}))

vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: vi.fn(({ value, currency }: any) => (
        <span>
            {value?.toString()} {currency}
        </span>
    )),
}))

vi.mock('@components/NumberPad', () => ({
    NumberPad: vi.fn(() => <div data-testid='number-pad' />),
}))

vi.mock('@components/LoadingView', () => ({
    LoadingView: vi.fn(() => <div data-testid='loading-view' />),
}))

vi.mock('@modules/assets/components/AssetItem/AccountAssetItemView', () => ({
    AccountAssetItemView: vi.fn(() => <div data-testid='account-asset-item' />),
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: vi.fn(() => <div data-testid='account-display' />),
}))

vi.mock('../../../../components/send-funds/AddNotePanel', () => ({
    AddNotePanel: vi.fn(() => <div data-testid='send-funds-add-note-panel' />),
}))

vi.mock(
    '../../../../components/send-funds/SendFundsInfoPanel/SendFundsInfoPanel',
    () => ({
        SendFundsInfoPanel: vi.fn(() => (
            <div data-testid='send-funds-info-panel' />
        )),
    }),
)

vi.mock('../useInputScreen', () => ({
    useInputScreen: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(() => ({
        canSelectAsset: false,
        note: null,
        onFinished: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => null),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredFiatCurrency: 'USD',
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    }),
}))

const mockHandleNext = vi.fn()
const mockSetMax = vi.fn()
const mockHandleKey = vi.fn()

const mockDismissMaxExceeded = vi.fn()

const defaultInputViewReturn = {
    asset: { name: 'Algorand', unitName: 'ALGO', decimals: 6 },
    selectedAsset: { assetId: 0 },
    params: { minFee: 1000 },
    accountInformation: { amount: 1000000n, minBalance: 100000n },
    cryptoValue: null,
    fiatValue: null,
    setMax: mockSetMax,
    handleKey: mockHandleKey,
    handleNext: mockHandleNext,
    isMaxExceeded: false,
    dismissMaxExceeded: mockDismissMaxExceeded,
}

describe('InputScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useInputScreen as Mock).mockReturnValue(defaultInputViewReturn)
    })

    it('shows LoadingView when asset is missing', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            asset: null,
        })

        render(<InputScreen />)

        expect(screen.getByTestId('loading-view')).toBeTruthy()
    })

    it('shows LoadingView when selectedAsset is missing', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            selectedAsset: null,
        })

        render(<InputScreen />)

        expect(screen.getByTestId('loading-view')).toBeTruthy()
    })

    it('shows LoadingView when params is missing', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            params: null,
        })

        render(<InputScreen />)

        expect(screen.getByTestId('loading-view')).toBeTruthy()
    })

    it('shows LoadingView when accountInformation is missing', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            accountInformation: null,
        })

        render(<InputScreen />)

        expect(screen.getByTestId('loading-view')).toBeTruthy()
    })

    it('renders amount display when data is ready', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
        })

        render(<InputScreen />)

        expect(screen.getByText('10 ALGO')).toBeTruthy()
    })

    it('shows "--" when fiatValue is null', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
            fiatValue: null,
        })

        render(<InputScreen />)

        expect(screen.getByText('--')).toBeTruthy()
    })

    it('renders fiat CurrencyDisplay when fiatValue is present', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
            fiatValue: Decimal('25.50'),
        })

        render(<InputScreen />)

        expect(screen.getByText('25.5 USD')).toBeTruthy()
    })

    it('disables next button when cryptoValue is falsy', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: null,
        })

        render(<InputScreen />)

        const nextButton = screen.getByText('send_funds.input.next')
        expect(nextButton.closest('[data-disabled]')).toBeTruthy()
    })

    it('enables next button when cryptoValue is present', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
        })

        render(<InputScreen />)

        const nextButton = screen.getByText('send_funds.input.next')
        expect(nextButton.closest('[data-disabled]')).toBeNull()
    })

    it('calls handleNext when next button is pressed', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
        })

        render(<InputScreen />)

        fireEvent.click(screen.getByText('send_funds.input.next'))

        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('calls setMax when max button is pressed', () => {
        render(<InputScreen />)

        fireEvent.click(screen.getByText('send_funds.input.max'))

        expect(mockSetMax).toHaveBeenCalledTimes(1)
    })
})
