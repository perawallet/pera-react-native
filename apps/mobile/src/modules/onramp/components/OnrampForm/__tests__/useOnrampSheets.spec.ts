/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { OnrampEvent } from '@analytics'

import { OnrampPairSelectionContent } from '../../OnrampPairSelectionContent'
import { OnrampPaymentMethodContent } from '../../OnrampPaymentMethodContent'
import { OnrampProviderContent } from '../../OnrampProviderContent'
import { OnrampSenderAddressContent } from '../../OnrampSenderAddressContent'
import { OnrampSourceSelectionContent } from '../../OnrampSourceSelectionContent'
import { useOnrampSheets } from '../useOnrampSheets'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    requestBottomSheet: vi.fn(),
    trackOnrampEvent: vi.fn(),
    scope: null as { chainId: string; networkId: string } | null,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
}))

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({ scope: mocks.scope }),
}))

vi.mock('@modules/onramp/hooks/useTrackOnrampEvent', () => ({
    useTrackOnrampEvent: () => mocks.trackOnrampEvent,
}))

vi.mock('../../OnrampSourceSelectionContent', () => ({
    OnrampSourceSelectionContent: () => null,
}))
vi.mock('../../OnrampPairSelectionContent', () => ({
    OnrampPairSelectionContent: () => null,
}))
vi.mock('../../OnrampProviderContent', () => ({
    OnrampProviderContent: () => null,
}))
vi.mock('../../OnrampPaymentMethodContent', () => ({
    OnrampPaymentMethodContent: () => null,
}))
vi.mock('../../OnrampSenderAddressContent', () => ({
    OnrampSenderAddressContent: () => null,
}))

const QUOTES = [{ id: 'quote-1' }] as unknown as RampQuote[]
const PRICE = new Decimal('0.25')

const params = {
    quotes: QUOTES,
    sourceAmount: new Decimal('100'),
    selectedQuoteId: 'quote-1',
    selectQuote: vi.fn(),
    selectedPaymentMethodId: 'card',
    selectPaymentMethod: vi.fn(),
    destinationPriceInUsd: PRICE,
    senderAddress: 'SENDER',
    setSelectedSourceTokenId: vi.fn(),
    setSelectedDestinationTokenId: vi.fn(),
    setSenderAddress: vi.fn(),
}

const renderSheets = () => renderHook(() => useOnrampSheets(params))

const lastSheet = () => mocks.requestBottomSheet.mock.calls.at(-1)?.[0]

describe('useOnrampSheets', () => {
    beforeEach(() => {
        mocks.scope = SCOPE
        mocks.requestBottomSheet.mockResolvedValue(undefined)
    })

    describe('source selection', () => {
        it('commits the picked source token', async () => {
            mocks.requestBottomSheet.mockResolvedValue('usdc')
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(lastSheet()).toEqual({
                contents: expect.objectContaining({
                    type: OnrampSourceSelectionContent,
                }),
                options: {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            expect(params.setSelectedSourceTokenId).toHaveBeenCalledWith('usdc')
        })

        it('keeps the source when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(params.setSelectedSourceTokenId).not.toHaveBeenCalled()
        })
    })

    describe('destination selection', () => {
        it('opens the destination picker for the account scope and commits the pick', async () => {
            mocks.requestBottomSheet.mockResolvedValue('algo')
            const { result } = renderSheets()

            await act(() => result.current.handleOpenDestinationSelection())

            expect(lastSheet().contents.type).toBe(OnrampPairSelectionContent)
            expect(lastSheet().contents.props).toEqual({
                variant: 'destination',
                scope: SCOPE,
            })
            expect(params.setSelectedDestinationTokenId).toHaveBeenCalledWith(
                'algo',
            )
        })

        it('keeps the destination when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenDestinationSelection())

            expect(params.setSelectedDestinationTokenId).not.toHaveBeenCalled()
        })

        it('opens nothing without an onramp account scope', async () => {
            mocks.scope = null
            const { result } = renderSheets()

            await act(() => result.current.handleOpenDestinationSelection())

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        })
    })

    describe('provider', () => {
        it('passes the quotes and selection to the sheet and applies the picked quote', async () => {
            mocks.requestBottomSheet.mockResolvedValue('quote-2')
            const { result } = renderSheets()

            await act(() => result.current.handleOpenProvider())

            expect(lastSheet().contents.type).toBe(OnrampProviderContent)
            expect(lastSheet().contents.props).toEqual({
                quotes: QUOTES,
                sourceAmount: new Decimal('100'),
                selectedQuoteId: 'quote-1',
                selectedPaymentMethodId: 'card',
                destinationPriceInUsd: PRICE,
            })
            expect(mocks.trackOnrampEvent.mock.calls).toEqual([
                [OnrampEvent.ProviderTap],
                [OnrampEvent.ProviderSelect],
            ])
            expect(params.selectQuote).toHaveBeenCalledWith('quote-2')
        })

        it('tracks only the tap when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenProvider())

            expect(mocks.trackOnrampEvent.mock.calls).toEqual([
                [OnrampEvent.ProviderTap],
            ])
            expect(params.selectQuote).not.toHaveBeenCalled()
        })
    })

    describe('payment method', () => {
        it('applies the picked payment method', async () => {
            mocks.requestBottomSheet.mockResolvedValue('bank')
            const { result } = renderSheets()

            await act(() => result.current.handleOpenPaymentMethod())

            expect(lastSheet().contents.type).toBe(OnrampPaymentMethodContent)
            expect(lastSheet().contents.props).toEqual({
                quotes: QUOTES,
                selectedPaymentMethodId: 'card',
            })
            expect(params.selectPaymentMethod).toHaveBeenCalledWith('bank')
        })

        it('keeps the payment method when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenPaymentMethod())

            expect(params.selectPaymentMethod).not.toHaveBeenCalled()
        })
    })

    describe('sender address', () => {
        it('opens an auto-sized sheet prefilled with the current sender and applies the new one', async () => {
            mocks.requestBottomSheet.mockResolvedValue('NEW_SENDER')
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSenderAddress())

            expect(lastSheet()).toEqual({
                contents: expect.objectContaining({
                    type: OnrampSenderAddressContent,
                    props: { initialAddress: 'SENDER' },
                }),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            expect(mocks.trackOnrampEvent.mock.calls).toEqual([
                [OnrampEvent.SenderAddressOpen],
                [OnrampEvent.SenderAddressApply],
            ])
            expect(params.setSenderAddress).toHaveBeenCalledWith('NEW_SENDER')
        })

        it('keeps the sender when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSenderAddress())

            expect(mocks.trackOnrampEvent.mock.calls).toEqual([
                [OnrampEvent.SenderAddressOpen],
            ])
            expect(params.setSenderAddress).not.toHaveBeenCalled()
        })
    })
})
