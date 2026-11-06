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

import { renderHook, act } from '@test-utils/render'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    RampAmountOutOfRangeError,
    type RampQuote,
} from '@perawallet/wallet-core-onramp'
import {
    makeAlgoToken,
    makeDepositToken,
    makeFiatToken,
    makeRampPair,
} from '@test-utils/rampFixtures'
import { useOnrampQuotes } from '../useOnrampQuotes'

const mockCreateQuote = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-onramp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-onramp')
    >()),
    useCreateRampQuoteMutation: () => ({ mutateAsync: mockCreateQuote }),
}))

// Stable across renders like the real hook's memoised scope; a fresh object
// would refire the quote effect on every render.
const SCOPE = { chainId: 'algorand', networkId: 'mainnet' }

vi.mock('@modules/onramp/hooks/useOnrampAccount', () => ({
    useOnrampAccount: () => ({ account: null, scope: SCOPE, address: 'ADDR' }),
}))

const FIAT_PAIR = makeRampPair(makeFiatToken('EUR'), makeAlgoToken())
const DEPOSIT_PAIR = makeRampPair(makeDepositToken(), makeAlgoToken())

const quote = (quoteId: string, kind: RampQuote['kind']): RampQuote => ({
    kind,
    quoteId,
    provider: 'P',
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(1),
    destinationAmount: new Decimal(10),
    sourceValueInUsd: null,
    destinationValueInUsd: null,
})

const DEBOUNCE_MS = 500

const settle = () =>
    act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    })

type Params = Parameters<typeof useOnrampQuotes>[0]

const render = (overrides: Partial<Params> = {}) =>
    renderHook((params: Params) => useOnrampQuotes(params), {
        initialProps: {
            pair: DEPOSIT_PAIR,
            sourceAmount: new Decimal('0.5'),
            refundAddress: null,
            countryCode: null,
            ...overrides,
        },
    })

describe('useOnrampQuotes', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockCreateQuote.mockResolvedValue([])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('quotes a deposit pair again for every new amount', async () => {
        mockCreateQuote.mockResolvedValue([quote('x1', 'xo')])
        const { rerender } = render()
        await settle()

        rerender({
            pair: DEPOSIT_PAIR,
            sourceAmount: new Decimal('0.9'),
            refundAddress: null,
            countryCode: null,
        })
        await settle()

        expect(mockCreateQuote).toHaveBeenCalledTimes(2)
        expect(mockCreateQuote).toHaveBeenLastCalledWith(
            expect.objectContaining({ sourceAmount: new Decimal('0.9') }),
        )
    })

    it.each([
        ['no amount', null],
        ['an amount of zero', new Decimal(0)],
        [
            'an amount that floors to zero base units',
            new Decimal('0.000000001'),
        ],
    ])(
        'asks for no quote with %s, and shows no error',
        async (_name, amount) => {
            const { result } = render({ sourceAmount: amount })
            await settle()

            expect(mockCreateQuote).not.toHaveBeenCalled()
            expect(result.current.quotes).toEqual([])
            expect(result.current.quotesError).toBeNull()
            expect(result.current.isQuoting).toBe(false)
        },
    )

    it('sends the refund address and the country with the request', async () => {
        render({
            pair: FIAT_PAIR,
            sourceAmount: new Decimal(100),
            refundAddress: 'REFUND',
            countryCode: 'DE',
        })
        await settle()

        expect(mockCreateQuote).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: SCOPE,
                destinationAddress: 'ADDR',
                refundAddress: 'REFUND',
                countryCode: 'DE',
            }),
        )
    })

    it("maps a refused maximum onto the above-max copy with the router's limit", async () => {
        mockCreateQuote.mockRejectedValue(
            new RampAmountOutOfRangeError(
                'max',
                { min: null, max: new Decimal(5000) },
                'Too high.',
            ),
        )
        const { result } = render()
        await settle()

        expect(result.current.quotesError).toBe('onramp.form.amount_above_max')
        expect(result.current.quoteLimits?.max?.toString()).toBe('5000')
    })

    it('maps a refused minimum onto the below-min copy', async () => {
        mockCreateQuote.mockRejectedValue(
            new RampAmountOutOfRangeError(
                'min',
                { min: new Decimal(600), max: null },
                'Too low.',
            ),
        )
        const { result } = render()
        await settle()

        expect(result.current.quotesError).toBe('onramp.form.amount_below_min')
        expect(result.current.quoteLimits?.min?.toString()).toBe('600')
    })

    it('picks the best quote and ranks offers within a payment method', async () => {
        mockCreateQuote.mockResolvedValue([
            { ...quote('low', 'meld'), destinationAmount: new Decimal(5) },
            { ...quote('high', 'meld'), destinationAmount: new Decimal(9) },
        ])
        const { result } = render({ pair: FIAT_PAIR })
        await settle()

        expect(result.current.selectedQuote?.quoteId).toBe('high')
        expect(result.current.isBestOffer).toBe(true)
    })
})
