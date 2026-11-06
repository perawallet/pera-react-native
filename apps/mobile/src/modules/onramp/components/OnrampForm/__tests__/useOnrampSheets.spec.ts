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
import type { RampQuote } from '@perawallet/wallet-core-onramp'
import { OnrampEvent } from '@analytics'
import { makeDepositToken, makeFiatToken } from '@test-utils/rampFixtures'

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

const BITCOIN = makeDepositToken('BTC')
const SOLANA_USDC = makeDepositToken('USDC', {
    id: 'solana:main/token:usdc',
    network: { name: 'Solana', logo: null },
})
const USD = makeFiatToken('USD')

const params = {
    quotes: QUOTES,
    selectedQuoteId: 'quote-1',
    selectQuote: vi.fn(),
    selectedPaymentMethodId: 'card',
    selectPaymentMethod: vi.fn(),
    destinationSymbol: 'ALGO',
    senderAddress: 'SENDER',
    sourceToken: BITCOIN as typeof BITCOIN | null,
    setSelectedSourceTokenId: vi.fn(),
    setSelectedDestinationTokenId: vi.fn(),
    setSelectedChainId: vi.fn(),
    setSenderAddress: vi.fn(),
}

const renderSheets = (overrides: Partial<typeof params> = {}) =>
    renderHook(() => useOnrampSheets({ ...params, ...overrides }))

const lastSheet = () => mocks.requestBottomSheet.mock.calls.at(-1)?.[0]

describe('useOnrampSheets', () => {
    beforeEach(() => {
        mocks.scope = SCOPE
        mocks.requestBottomSheet.mockResolvedValue(undefined)
    })

    describe('source selection', () => {
        it('commits the picked source token', async () => {
            mocks.requestBottomSheet.mockResolvedValue(SOLANA_USDC)
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
            expect(params.setSelectedSourceTokenId).toHaveBeenCalledWith(
                SOLANA_USDC.id,
            )
        })

        it("tracks the pick with the source's chain", async () => {
            mocks.requestBottomSheet.mockResolvedValue(SOLANA_USDC)
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(mocks.trackOnrampEvent).toHaveBeenCalledWith(
                OnrampEvent.SourceSelect,
                { source_chain: 'Solana' },
            )
        })

        it('tracks a fiat pick without a source chain', async () => {
            mocks.requestBottomSheet.mockResolvedValue(USD)
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(mocks.trackOnrampEvent).toHaveBeenCalledWith(
                OnrampEvent.SourceSelect,
                undefined,
            )
        })

        it("clears a sender address entered for the previous source's chain", async () => {
            mocks.requestBottomSheet.mockResolvedValue(SOLANA_USDC)
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(params.setSenderAddress).toHaveBeenCalledWith('')
        })

        it('keeps the sender address when the same source is picked again', async () => {
            mocks.requestBottomSheet.mockResolvedValue(BITCOIN)
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(params.setSenderAddress).not.toHaveBeenCalled()
        })

        it('keeps the source when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenSourceSelection())

            expect(params.setSelectedSourceTokenId).not.toHaveBeenCalled()
        })
    })

    describe('destination selection', () => {
        it('opens the destination picker for the account scope and commits the picked token and its chain', async () => {
            mocks.requestBottomSheet.mockResolvedValue({
                chainId: 'ethereum',
                tokenId: 'eth',
            })
            const { result } = renderSheets()

            await act(() => result.current.handleOpenDestinationSelection())

            expect(lastSheet().contents.type).toBe(OnrampPairSelectionContent)
            expect(lastSheet().contents.props).toEqual({ scope: SCOPE })
            expect(params.setSelectedDestinationTokenId).toHaveBeenCalledWith(
                'eth',
            )
            expect(params.setSelectedChainId).toHaveBeenCalledWith('ethereum')
            expect(mocks.trackOnrampEvent).toHaveBeenCalledWith(
                OnrampEvent.DestinationSelect,
            )
        })

        it('keeps the destination and the chain when the sheet is dismissed', async () => {
            const { result } = renderSheets()

            await act(() => result.current.handleOpenDestinationSelection())

            expect(params.setSelectedDestinationTokenId).not.toHaveBeenCalled()
            expect(params.setSelectedChainId).not.toHaveBeenCalled()
            expect(mocks.trackOnrampEvent).not.toHaveBeenCalled()
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
                selectedQuoteId: 'quote-1',
                selectedPaymentMethodId: 'card',
                destinationSymbol: 'ALGO',
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
                    props: { initialAddress: 'SENDER', sourceToken: BITCOIN },
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

        it('opens nothing before a source is chosen', async () => {
            const { result } = renderSheets({ sourceToken: null })

            await act(() => result.current.handleOpenSenderAddress())

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        })
    })
})
