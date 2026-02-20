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

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

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
    PWView: vi.fn(({ children }: any) => <div>{children}</div>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: vi.fn(({ children }: any) => <span>{children}</span>),

    PWIcon: vi.fn(() => <div />),
}))

vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: vi.fn(({ value, currency }: any) => (
        <span>
            {value?.toString()} {currency}
        </span>
    )),
}))

vi.mock('@components/PreferredCurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PreferredCurrencyDisplay: vi.fn(({ sourceAmount, sourceAssetId }: any) => (
        <span data-testid='preferred-currency-display'>
            {sourceAmount?.toString()} {sourceAssetId}
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

vi.mock('../../../../components/send-funds/InsufficientBalancePanel', () => ({
    InsufficientBalancePanel: vi.fn(() => (
        <div data-testid='insufficient-balance-panel' />
    )),
}))

vi.mock('../../../../components/send-funds/CloseAccountPanel', () => ({
    CloseAccountPanel: vi.fn(() => <div data-testid='close-account-panel' />),
}))

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
const mockHandleContinuePastMbr = vi.fn()
const mockDismissCloseAccount = vi.fn()
const mockHandleConfirmCloseAccount = vi.fn()

const defaultInputViewReturn = {
    asset: { name: 'Algorand', unitName: 'ALGO', decimals: 6 },
    selectedAsset: { assetId: 0 },
    params: { minFee: 1000 },
    accountInformation: { amount: 1000000n, minBalance: 100000n },
    cryptoValue: null,
    setMax: mockSetMax,
    handleKey: mockHandleKey,
    handleNext: mockHandleNext,
    handleContinuePastMbr: mockHandleContinuePastMbr,
    isMaxExceeded: false,
    dismissMaxExceeded: mockDismissMaxExceeded,
    minBalanceDisplay: '0.1',
    isCloseAccountEligible: false,
    dismissCloseAccount: mockDismissCloseAccount,
    handleConfirmCloseAccount: mockHandleConfirmCloseAccount,
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

    it('renders PreferredCurrencyDisplay with null sourceAmount when cryptoValue is null', () => {
        render(<InputScreen />)

        const display = screen.getByTestId('preferred-currency-display')
        expect(display).toBeTruthy()
        expect(display.textContent).toContain('0')
    })

    it('renders PreferredCurrencyDisplay with sourceAmount when cryptoValue is present', () => {
        ;(useInputScreen as Mock).mockReturnValue({
            ...defaultInputViewReturn,
            cryptoValue: '10',
        })

        render(<InputScreen />)

        const display = screen.getByTestId('preferred-currency-display')
        expect(display).toBeTruthy()
        expect(display.textContent).toContain('10')
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
