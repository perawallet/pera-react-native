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
import { Decimal } from 'decimal.js'
import type { Optional } from '@perawallet/wallet-core-shared'
import { render, fireEvent } from '@test-utils/render'
import { TransactionConfirmationScreen } from '../TransactionConfirmationScreen'
import { useTransactionConfirmationScreen } from '../useTransactionConfirmationScreen'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
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
    PWText: ({ children, onPress, ...rest }: any) => (
        <span
            onClick={onPress}
            {...rest}
        >
            {children}
        </span>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress }: any) => (
        <button onClick={onPress}>{children}</button>
    ),
    PWDivider: () => <hr data-testid='divider' />,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWIcon: ({ name }: any) => <div data-testid={`icon-${name}`} />,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWScrollView: ({ children, contentContainerStyle }: any) => (
        <div style={contentContainerStyle}>{children}</div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWRoundIcon: ({ icon }: any) => <div data-testid={`round-icon-${icon}`} />,
}))

vi.mock('@components/KeyValueRow', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    KeyValueRow: ({ title, children }: any) => (
        <div data-testid={`key-value-row-${title}`}>{children}</div>
    ),
}))

vi.mock('@components/CurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrencyDisplay: ({ currency, value, isLoading }: any) => (
        <span data-testid={`currency-display-${currency}`}>
            {isLoading ? 'loading' : (value?.toString() ?? 'null')}
        </span>
    ),
}))

vi.mock('@components/PreferredCurrencyDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PreferredCurrencyDisplay: ({ sourceAssetId }: any) => (
        <span data-testid={`preferred-currency-display-${sourceAssetId}`} />
    ),
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountDisplay: ({ account }: any) => (
        <div data-testid='account-display'>{account.address}</div>
    ),
}))

vi.mock('@components/AddressDisplay', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AddressDisplay: ({ address }: any) => (
        <div data-testid='address-display'>{address}</div>
    ),
}))

vi.mock('@components/LoadingView', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LoadingView: ({ variant }: any) => (
        <div data-testid='loading-view'>{variant}</div>
    ),
}))

vi.mock('../../../../components/send-funds/AddNotePanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AddNotePanel: ({ isVisible, onClose }: any) =>
        isVisible ? (
            <div data-testid='add-note-panel'>
                <button
                    data-testid='close-note-panel'
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        ) : null,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: {
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
    },
    ALGO_ASSET_ID: '0',
    toWholeUnits: vi.fn(() => new Decimal('0.001')),
    useAssetPricesQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        fallbackCurrency: 'USD',
        algoUsdPrice: new Decimal(0),
        usdToPreferred: (v: Decimal) => v,
    })),
    usePreferredCurrencyPriceQuery: vi.fn(() => ({
        data: undefined,
        isPending: false,
    })),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        secondaryAmount: {},
        buttonContainer: {},
        linkContainer: {},
        link: {},
        divider: {},
    }),
}))

vi.mock('../useTransactionConfirmationScreen', () => ({
    useTransactionConfirmationScreen: vi.fn(),
}))

vi.mock('../CloseAccountWarning', () => ({
    CloseAccountWarning: () => <div data-testid='close-account-warning' />,
}))

const mockHandleConfirm = vi.fn()
const mockOpenNote = vi.fn()
const mockCloseNote = vi.fn()

const defaultHookReturn = {
    asset: { unitName: 'ALGO', decimals: 6 },
    amount: new Decimal('10.5'),
    destination: 'DEST_ADDRESS_ABC123',
    selectedAccount: { address: 'ACCOUNT_ADDRESS_ABC123' },
    preferredCurrency: 'USD',
    params: { minFee: 1000 },
    paramsPending: false,
    currentBalance: {
        amount: new Decimal('100'),
    },
    currentBalancePending: false,
    note: undefined as Optional<string>,
    noteOpen: false,
    openNote: mockOpenNote,
    closeNote: mockCloseNote,
    handleConfirm: mockHandleConfirm,
    isReady: true,
}

describe('TransactionConfirmationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
        })
    })

    it('shows LoadingView when isReady is false', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            isReady: false,
        })

        const { getByTestId, queryByText } = render(
            <TransactionConfirmationScreen />,
        )

        expect(getByTestId('loading-view')).toBeTruthy()
        expect(queryByText('send_funds.confirmation.confirm_button')).toBeNull()
    })

    it('renders amount key-value row', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId('key-value-row-send_funds.confirmation.amount'),
        ).toBeTruthy()
    })

    it('renders account display when selectedAccount is present', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId('key-value-row-send_funds.confirmation.account'),
        ).toBeTruthy()
        expect(getByTestId('account-display')).toBeTruthy()
    })

    it('does not render account display when selectedAccount is null', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            selectedAccount: null,
        })

        const { queryByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            queryByTestId('key-value-row-send_funds.confirmation.account'),
        ).toBeNull()
    })

    it('renders destination display when destination is present', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId('key-value-row-send_funds.confirmation.to'),
        ).toBeTruthy()
        expect(getByTestId('address-display')).toBeTruthy()
    })

    it('does not render destination display when destination is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            destination: undefined,
        })

        const { queryByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            queryByTestId('key-value-row-send_funds.confirmation.to'),
        ).toBeNull()
    })

    it('renders fee key-value row', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId('key-value-row-send_funds.confirmation.fee'),
        ).toBeTruthy()
    })

    it('renders current balance key-value row when balance exists', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId(
                'key-value-row-send_funds.confirmation.current_balance',
            ),
        ).toBeTruthy()
    })

    it('does not render current balance row when currentBalance is undefined', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            currentBalance: undefined,
        })

        const { queryByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            queryByTestId(
                'key-value-row-send_funds.confirmation.current_balance',
            ),
        ).toBeNull()
    })

    it('renders note key-value row', () => {
        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(
            getByTestId('key-value-row-send_funds.confirmation.note'),
        ).toBeTruthy()
    })

    it('calls handleConfirm when confirm button is pressed', () => {
        const { getByText } = render(<TransactionConfirmationScreen />)

        fireEvent.click(getByText('send_funds.confirmation.confirm_button'))

        expect(mockHandleConfirm).toHaveBeenCalledTimes(1)
    })

    it('shows note text and edit button when note exists', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            note: 'Payment for services',
        })

        const { getByText, getByTestId } = render(
            <TransactionConfirmationScreen />,
        )

        expect(getByText('Payment for services')).toBeTruthy()
        expect(getByText('send_funds.confirmation.edit')).toBeTruthy()
        expect(getByTestId('icon-edit-pen')).toBeTruthy()
    })

    it('calls openNote when edit button is pressed with existing note', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            note: 'Payment for services',
        })

        const { getByText } = render(<TransactionConfirmationScreen />)

        fireEvent.click(getByText('send_funds.confirmation.edit'))

        expect(mockOpenNote).toHaveBeenCalledTimes(1)
    })

    it('shows add note button when no note exists', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            note: undefined,
        })

        const { getByText, queryByText } = render(
            <TransactionConfirmationScreen />,
        )

        expect(getByText('send_funds.add_note.button')).toBeTruthy()
        expect(queryByText('send_funds.confirmation.edit')).toBeNull()
    })

    it('calls openNote when add note button is pressed', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            note: undefined,
        })

        const { getByText } = render(<TransactionConfirmationScreen />)

        fireEvent.click(getByText('send_funds.add_note.button'))

        expect(mockOpenNote).toHaveBeenCalledTimes(1)
    })

    it('renders AddNotePanel when noteOpen is true', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            noteOpen: true,
        })

        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(getByTestId('add-note-panel')).toBeTruthy()
    })

    it('does not render AddNotePanel when noteOpen is false', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            noteOpen: false,
        })

        const { queryByTestId } = render(<TransactionConfirmationScreen />)

        expect(queryByTestId('add-note-panel')).toBeNull()
    })

    it('calls closeNote when note panel close is triggered', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            noteOpen: true,
        })

        const { getByTestId } = render(<TransactionConfirmationScreen />)

        fireEvent.click(getByTestId('close-note-panel'))

        expect(mockCloseNote).toHaveBeenCalledTimes(1)
    })

    it('calls useTransactionConfirmationScreen with no arguments', () => {
        render(<TransactionConfirmationScreen />)

        expect(useTransactionConfirmationScreen).toHaveBeenCalledWith()
    })

    it('renders RecipientBelowMbrWarning when isRecipientBelowMbr is true', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            isRecipientBelowMbr: true,
            recipientMbrDisplay: '0.1',
        })

        const { getByTestId } = render(<TransactionConfirmationScreen />)

        expect(getByTestId('round-icon-info')).toBeTruthy()
    })

    it('does not render RecipientBelowMbrWarning when isRecipientBelowMbr is false', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            isRecipientBelowMbr: false,
        })

        const { queryByTestId } = render(<TransactionConfirmationScreen />)

        expect(queryByTestId('round-icon-info')).toBeNull()
    })

    it('renders fiat values for amount and current balance for non-collectibles', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            isCollectible: false,
            selectedAssetId: '123',
        })

        const { queryAllByTestId } = render(<TransactionConfirmationScreen />)

        expect(queryAllByTestId('preferred-currency-display-123').length).toBe(
            2,
        )
    })

    it('hides fiat values when sending a collectible', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionConfirmationScreen as any).mockReturnValue({
            ...defaultHookReturn,
            isCollectible: true,
            selectedAssetId: '123',
        })

        const { queryAllByTestId } = render(<TransactionConfirmationScreen />)

        expect(queryAllByTestId('preferred-currency-display-123').length).toBe(
            0,
        )
    })
})
