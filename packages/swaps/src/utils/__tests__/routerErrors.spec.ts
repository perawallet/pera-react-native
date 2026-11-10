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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    PeraNetworkError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import { SwapQuoteMismatchError } from '../../errors'
import { isSwapQuoteGoneError, swapQuoteFailureOf } from '../routerErrors'

const refusal = (backendCode?: string) =>
    new PeraNetworkError('client', { status: 409, backendCode })

const routerRefusal = (
    status: number,
    data: Record<string, unknown>,
    kind: 'client' | 'server' = 'client',
) =>
    new PeraNetworkError(kind, {
        status,
        originalError: Object.assign(new Error('http'), { data }),
    })

describe('isSwapQuoteGoneError', () => {
    it('matches a spent or unknown quote', () => {
        expect(isSwapQuoteGoneError(refusal('quote_already_used'))).toBe(true)
        expect(isSwapQuoteGoneError(refusal('quote_not_found'))).toBe(true)
    })

    it('ignores other refusals and plain errors', () => {
        expect(isSwapQuoteGoneError(refusal('invalid_request'))).toBe(false)
        expect(isSwapQuoteGoneError(refusal())).toBe(false)
        expect(isSwapQuoteGoneError(new Error('quote_not_found'))).toBe(false)
    })
})

describe('swapQuoteFailureOf', () => {
    it.each([
        [422, 'invalid_amount', { kind: 'invalid-amount' }],
        [422, 'pair_not_supported', { kind: 'no-route' }],
        [403, 'pair_restricted_in_country', { kind: 'unsupported' }],
        [422, 'invalid_asset_id', { kind: 'unsupported' }],
        [422, 'chain_not_enabled', { kind: 'unsupported' }],
        [503, 'route_unavailable', { kind: 'unavailable' }],
        [503, 'upstream_unavailable', { kind: 'unavailable' }],
        [429, 'upstream_rate_limited', { kind: 'unavailable' }],
        [422, 'something_new', { kind: 'unavailable' }],
    ])('maps %i %s', (status, code, expected) => {
        const error = routerRefusal(status, { error: 'Nope', code })

        expect(swapQuoteFailureOf(error)).toEqual(expected)
    })

    it('carries the minimum of a too-low refusal as a Decimal', () => {
        const error = routerRefusal(422, {
            error: 'Too low',
            code: 'amount_too_low',
            source_amount_minimum: '2000',
        })

        expect(swapQuoteFailureOf(error)).toEqual({
            kind: 'amount-too-low',
            minimum: new Decimal(2000),
        })
    })

    it('has no minimum when the router named none', () => {
        const error = routerRefusal(422, {
            error: 'Too low',
            code: 'amount_too_low',
            source_amount_minimum: null,
        })

        expect(swapQuoteFailureOf(error)).toEqual({
            kind: 'amount-too-low',
            minimum: null,
        })
    })

    it('carries the maximum of a too-high refusal', () => {
        const error = routerRefusal(422, {
            error: 'Too high',
            code: 'amount_too_high',
            source_amount_maximum: '9000000',
        })

        expect(swapQuoteFailureOf(error)).toEqual({
            kind: 'amount-too-high',
            maximum: new Decimal(9000000),
        })
    })

    it('reads the code off the typed error when the body did not parse', () => {
        const error = new PeraNetworkError('client', {
            status: 422,
            backendCode: 'pair_not_supported',
        })

        expect(swapQuoteFailureOf(error)).toEqual({ kind: 'no-route' })
    })

    it.each([
        ['offline', new PeraNetworkError('offline')],
        ['timeout', new PeraNetworkError('timeout')],
        ['a plain error', new Error('boom')],
        ['a non-error', 'boom'],
        ['a quote mismatch', new SwapQuoteMismatchError('mismatch')],
    ])('treats %s as unavailable', (_name, error) => {
        expect(swapQuoteFailureOf(error)).toEqual({ kind: 'unavailable' })
    })

    it('treats a refusal raised before sending for a refused chain as unsupported', () => {
        const error = new PeraServiceUnavailableError(
            { chainId: 'base', networkId: 'mainnet' },
            undefined,
            { isChainRefused: true },
        )

        expect(swapQuoteFailureOf(error)).toEqual({ kind: 'unsupported' })
    })
})
