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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    NoConnectionError,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'
import {
    isTransientRampError,
    isSourceAmountTooHighError,
    isSourceAmountTooLowError,
    RampAmountOutOfRangeError,
    RampAttestationRequiredError,
    resolveRampQuoteLimits,
    toOnrampUserMessage,
} from '..'

const tooLow = (
    min: Decimal | null = new Decimal(600),
    max: Decimal | null = null,
) => new RampAmountOutOfRangeError('min', { min, max }, 'Amount is too low.')

describe('RampAmountOutOfRangeError', () => {
    it('is an expected outcome, kept out of crash reporting', () => {
        expect(tooLow().metadata.expected).toBe(true)
    })
})

describe('isTransientRampError', () => {
    it.each([
        ['offline', new NoConnectionError(), true],
        ['a timeout', new PeraNetworkError('timeout'), true],
        ['a 5xx', new PeraNetworkError('server', { status: 503 }), true],
        [
            "an upstream's rate limit",
            new PeraNetworkError('client', {
                status: 429,
                backendCode: 'upstream_rate_limited',
            }),
            true,
        ],
        ['a refused amount', tooLow(), false],
        [
            'a 4xx validation error',
            new PeraNetworkError('client', {
                status: 400,
                backendCode: 'unsupported_pair',
            }),
            false,
        ],
    ])('treats %s as transient: %s', (_label, error, expected) => {
        expect(isTransientRampError(error)).toBe(expected)
    })
})

describe('toOnrampUserMessage', () => {
    it('maps a PeraException with fallback_message to that message', () => {
        const err = {
            type: 'SomeOtherError',
            fallback_message: 'Payment method not available.',
            detail: {},
        }
        expect(toOnrampUserMessage(err)).toBe('Payment method not available.')
    })

    it.each([
        ['an unknown Error', new Error('boom')],
        ['undefined', undefined],
        ['null', null],
    ])('has no message for %s', (_name, error) => {
        expect(toOnrampUserMessage(error)).toBeNull()
    })

    it('maps RampAttestationRequiredError to the onramp wording', () => {
        expect(toOnrampUserMessage(new RampAttestationRequiredError())).toBe(
            'Device verification is required to fund this account.',
        )
    })

    it("surfaces the router's message for a refused amount", () => {
        expect(toOnrampUserMessage(tooLow())).toBe('Amount is too low.')
    })

    it.each([
        ['pair_restricted_in_country', 403, 'Not available in your country.'],
        ['invalid_status_transition', 409, 'The order cannot be cancelled.'],
    ])('surfaces the router message of a %s error', (code, status, message) => {
        const httpError = {
            name: 'HTTPError',
            status,
            data: { error: message, code },
        }

        expect(toOnrampUserMessage(httpError)).toBe(message)
    })

    it.each([
        ['route_unavailable', 'The XO route is temporarily unavailable'],
        ['upstream_unavailable', 'Meld is unavailable, try again shortly'],
    ])(
        "has no message for a 5xx %s, whose text is the backend's English diagnostic",
        (code, message) => {
            const body = { error: message, code }
            const wrapped = new PeraNetworkError('server', {
                status: 503,
                originalError: Object.assign(new Error('http'), {
                    data: body,
                }),
            })

            expect(toOnrampUserMessage(wrapped)).toBeNull()
            expect(
                toOnrampUserMessage({
                    name: 'HTTPError',
                    status: 503,
                    data: body,
                }),
            ).toBeNull()
        },
    )

    it("has no message for an upstream's rate limit relayed as a 429", () => {
        expect(
            toOnrampUserMessage({
                name: 'HTTPError',
                status: 429,
                data: {
                    error: 'Meld rate limit exceeded',
                    code: 'upstream_rate_limited',
                },
            }),
        ).toBeNull()
    })

    it('maps server-side integrity-token rejections to the attestation wording', () => {
        const httpError = {
            name: 'HTTPError',
            status: 403,
            data: {
                error: 'Invalid or expired app integrity token',
                code: 'APP_INTEGRITY_TOKEN_INVALID',
            },
        }
        expect(toOnrampUserMessage(httpError)).toBe(
            'Device verification is required to fund this account.',
        )
    })

    it('reads the Pera exception body through a PeraNetworkError wrapper', () => {
        const httpError = Object.assign(new Error('http'), {
            data: {
                type: 'SomeError',
                fallback_message: 'Specific onramp message',
                detail: {},
            },
        })
        const wrapped = new PeraNetworkError('client', {
            status: 400,
            originalError: httpError,
        })
        expect(toOnrampUserMessage(wrapped)).toBe('Specific onramp message')
    })

    it('falls back rather than echoing a serialised dict as the message', () => {
        const result = toOnrampUserMessage({
            type: 'SomeOtherError',
            fallback_message: "{'message': 'nope'}",
            detail: {},
        })

        expect(result).toBeNull()
    })
})

describe('isSourceAmountTooLowError', () => {
    it('is true for a refused minimum, with or without a limit', () => {
        expect(isSourceAmountTooLowError(tooLow())).toBe(true)
        expect(isSourceAmountTooLowError(tooLow(null))).toBe(true)
    })

    it('is true through a network-error wrapper', () => {
        const wrapped = new PeraNetworkError('client', {
            status: 400,
            originalError: tooLow(),
        })

        expect(isSourceAmountTooLowError(wrapped)).toBe(true)
    })

    it('is false for a refused maximum and for other errors', () => {
        const tooHigh = new RampAmountOutOfRangeError(
            'max',
            { min: null, max: new Decimal(5000) },
            'Too high.',
        )

        expect(isSourceAmountTooLowError(tooHigh)).toBe(false)
        expect(isSourceAmountTooLowError(new Error('boom'))).toBe(false)
    })
})

describe('isSourceAmountTooHighError', () => {
    it('is true only for a refused maximum', () => {
        const tooHigh = new RampAmountOutOfRangeError(
            'max',
            { min: null, max: new Decimal(5000) },
            'Too high.',
        )

        expect(isSourceAmountTooHighError(tooHigh)).toBe(true)
        expect(isSourceAmountTooHighError(tooLow())).toBe(false)
        expect(isSourceAmountTooHighError(undefined)).toBe(false)
    })
})

describe('resolveRampQuoteLimits', () => {
    it('returns both limits', () => {
        const error = new RampAmountOutOfRangeError(
            'min',
            { min: new Decimal(600), max: new Decimal(5000) },
            'Too low.',
        )

        const limits = resolveRampQuoteLimits(error)

        expect(limits?.min?.toString()).toBe('600')
        expect(limits?.max?.toString()).toBe('5000')
    })

    it('keeps a min-only limit with a null max', () => {
        const limits = resolveRampQuoteLimits(tooLow())

        expect(limits?.min?.toString()).toBe('600')
        expect(limits?.max).toBeNull()
    })

    it('returns null when the router named neither bound', () => {
        expect(resolveRampQuoteLimits(tooLow(null, null))).toBeNull()
    })

    it('resolves through a PeraNetworkError wrapper', () => {
        const wrapped = new PeraNetworkError('client', {
            status: 400,
            originalError: tooLow(),
        })

        expect(resolveRampQuoteLimits(wrapped)?.min?.toString()).toBe('600')
    })

    it('returns null for plain errors and non-error values', () => {
        expect(resolveRampQuoteLimits(new Error('boom'))).toBeNull()
        expect(resolveRampQuoteLimits(undefined)).toBeNull()
        expect(resolveRampQuoteLimits(null)).toBeNull()
    })
})
