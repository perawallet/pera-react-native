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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'

import {
    COIN_ID,
    FIAT_ID,
    NATIVE_ID,
    ROUTER_ACCOUNT,
    SCOPE,
    ACCOUNT,
    coinAsset,
    depositOffer,
    fiatAsset,
    meldOffer,
    nativeAsset,
    registerRouterChain,
} from '../../../__tests__/routerFixtures'
import {
    RampAmountOutOfRangeError,
    isSourceAmountTooHighError,
    isSourceAmountTooLowError,
    toOnrampUserMessage,
} from '../../../errors'
import { toRampToken } from '../../router-asset'
import { createRampQuote, type CreateRampQuoteParams } from '../endpoints'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => registerRouterChain())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const fiatParams: CreateRampQuoteParams = {
    sourceToken: toRampToken(fiatAsset()),
    destinationToken: toRampToken(nativeAsset()),
    sourceAmount: new Decimal(600),
    destinationAddress: ACCOUNT,
    countryCode: 'DE',
    refundAddress: null,
}

const depositParams: CreateRampQuoteParams = {
    sourceToken: toRampToken(coinAsset()),
    destinationToken: toRampToken(nativeAsset()),
    sourceAmount: new Decimal('0.5'),
    destinationAddress: ACCOUNT,
    countryCode: null,
    refundAddress: 'REFUND',
}

const capture = (status: number, body: JsonBodyType): { bodies: unknown[] } => {
    const captured: { bodies: unknown[] } = { bodies: [] }
    server.use(
        http.post('*/api/v4/swap/quotes/', async ({ request }) => {
            captured.bodies.push(await request.json())
            return HttpResponse.json(body, { status })
        }),
    )
    return captured
}

describe('createRampQuote', () => {
    it('sends a fiat amount in the fiat base units, to the CAIP-10 account, with the country', async () => {
        const captured = capture(200, { results: [meldOffer()] })

        await createRampQuote(fiatParams, SCOPE)

        expect(captured.bodies).toEqual([
            {
                source_asset_id: FIAT_ID,
                destination_asset_id: NATIVE_ID,
                source_amount: '60000',
                destination_account: ROUTER_ACCOUNT,
                country: 'DE',
            },
        ])
    })

    it('sends the refund account of a deposit source, under the source chain', async () => {
        const captured = capture(200, { results: [depositOffer()] })

        await createRampQuote(depositParams, SCOPE)

        expect(captured.bodies[0]).toEqual({
            source_asset_id: COIN_ID,
            destination_asset_id: NATIVE_ID,
            source_amount: '50000000',
            destination_account: ROUTER_ACCOUNT,
            source_account: 'other:1:REFUND',
        })
    })

    it('sends no source account for a deposit source without a refund address', async () => {
        const captured = capture(200, { results: [] })

        await createRampQuote({ ...depositParams, refundAddress: null }, SCOPE)

        expect(captured.bodies[0]).not.toHaveProperty('source_account')
    })

    it('floors an amount finer than the source decimals', async () => {
        const captured = capture(200, { results: [] })

        await createRampQuote(
            { ...fiatParams, sourceAmount: new Decimal('10.009') },
            SCOPE,
        )

        expect(captured.bodies[0]).toMatchObject({ source_amount: '1000' })
    })

    it('returns the offers in the router order, without the ones the wallet signs', async () => {
        capture(200, {
            results: [
                meldOffer({ quote_id: 'a' }),
                meldOffer({
                    quote_id: 'b',
                    funding_method: 'wallet_transaction',
                }),
                meldOffer({ quote_id: 'c' }),
            ],
        })

        const quotes = await createRampQuote(fiatParams, SCOPE)

        expect(quotes.map(quote => quote.quoteId)).toEqual(['a', 'c'])
    })

    it('throws a below-minimum error carrying the minimum in display units', async () => {
        capture(422, {
            error: 'Amount is too low.',
            code: 'amount_too_low',
            source_amount_minimum: '60000',
        })

        const error = await createRampQuote(fiatParams, SCOPE).catch(
            (caught: unknown) => caught,
        )

        expect(error).toBeInstanceOf(RampAmountOutOfRangeError)
        expect(isSourceAmountTooLowError(error)).toBe(true)
        expect(
            (error as RampAmountOutOfRangeError).limits.min?.toString(),
        ).toBe('600')
        expect((error as RampAmountOutOfRangeError).limits.max).toBeNull()
    })

    it('keeps the below-minimum error when the router sends a null maximum', async () => {
        capture(422, {
            error: 'Amount is too low.',
            code: 'amount_too_low',
            source_amount_minimum: '60000',
            source_amount_maximum: null,
        })

        const error = await createRampQuote(fiatParams, SCOPE).catch(
            (caught: unknown) => caught,
        )

        expect(error).toBeInstanceOf(RampAmountOutOfRangeError)
        expect((error as RampAmountOutOfRangeError).limits.max).toBeNull()
    })

    it('throws an above-maximum error carrying the maximum', async () => {
        capture(422, {
            error: 'Amount is too high.',
            code: 'amount_too_high',
            source_amount_maximum: '500000',
        })

        const error = await createRampQuote(fiatParams, SCOPE).catch(
            (caught: unknown) => caught,
        )

        expect(isSourceAmountTooHighError(error)).toBe(true)
        expect(
            (error as RampAmountOutOfRangeError).limits.max?.toString(),
        ).toBe('5000')
    })

    it.each([
        ['pair_restricted_in_country', 403, 'Not available in your country.'],
        ['route_unavailable', 503, 'No route is available right now.'],
    ])(
        'rethrows a %s error, whose router message is the user message',
        async (code, status, message) => {
            capture(status, { error: message, code })

            const error = await createRampQuote(fiatParams, SCOPE).catch(
                (caught: unknown) => caught,
            )

            expect(error).not.toBeInstanceOf(RampAmountOutOfRangeError)
            expect(toOnrampUserMessage(error)).toBe(message)
        },
    )
})
