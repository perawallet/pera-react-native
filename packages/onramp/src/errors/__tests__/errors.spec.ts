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
import { FeeDelegationAttestationRequiredError } from '@perawallet/wallet-core-fee-delegation'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { resolveRampQuoteLimits, toOnrampUserMessage } from '..'

// The Pera API returns SourceAmountIsTooLow errors with this shape:
// {
//   type: 'SourceAmountIsTooLow',
//   fallback_message: '...',
//   detail: {
//     non_field_errors: ["{'message': 'Amount is too low.', 'min_amount': '10.00', 'max_amount': '5000.00'}"]
//   }
// }
// The `detail.non_field_errors[0]` is a single-quoted JSON string that must be
// normalised (replace ' → ") and parsed to extract min_amount / max_amount.
const sourceAmountIsTooLowError = {
    type: 'SourceAmountIsTooLow',
    fallback_message: 'Amount is too low.',
    detail: {
        non_field_errors: [
            "{'message': 'Amount is too low.', 'min_amount': '10.00', 'max_amount': '5000.00'}",
        ],
    },
}

describe('toOnrampUserMessage', () => {
    it('maps SourceAmountIsTooLow to a message containing the min limit', () => {
        const result = toOnrampUserMessage(sourceAmountIsTooLowError)
        expect(result).toContain('10')
    })

    it('maps SourceAmountIsTooLow to a message containing the max limit', () => {
        const result = toOnrampUserMessage(sourceAmountIsTooLowError)
        expect(result).toContain('5000')
    })

    it('unwraps a ky HTTPError that carries the exception body on .data', () => {
        // The shared client throws an HTTPError with the parsed body on `.data`.
        const httpError = {
            name: 'HTTPError',
            status: 400,
            data: sourceAmountIsTooLowError,
        }
        const result = toOnrampUserMessage(httpError)
        expect(result).toContain('10')
        expect(result).toContain('5000')
    })

    it('maps a PeraException with fallback_message to that message', () => {
        const err = {
            type: 'SomeOtherError',
            fallback_message: 'Payment method not available.',
            detail: {},
        }
        expect(toOnrampUserMessage(err)).toBe('Payment method not available.')
    })

    it('returns a generic fallback for an unknown Error', () => {
        expect(toOnrampUserMessage(new Error('boom'))).toMatch(
            /something went wrong/i,
        )
    })

    it('returns a generic fallback for a non-error value', () => {
        expect(toOnrampUserMessage(undefined)).toMatch(/something went wrong/i)
    })

    it('returns a generic fallback for null', () => {
        expect(toOnrampUserMessage(null)).toMatch(/something went wrong/i)
    })

    it('maps FeeDelegationAttestationRequiredError to the onramp wording', () => {
        expect(
            toOnrampUserMessage(new FeeDelegationAttestationRequiredError()),
        ).toBe('Device verification is required to fund this account.')
    })

    it('surfaces a bun-backend error body message', () => {
        const httpError = {
            name: 'HTTPError',
            status: 422,
            data: {
                error: 'Too many opt-ins (max 4)',
                code: 'TOO_MANY_OPT_INS',
            },
        }
        expect(toOnrampUserMessage(httpError)).toBe('Too many opt-ins (max 4)')
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
})

const buildTooLowError = (leaf: string) => ({
    type: 'SourceAmountIsTooLow',
    fallback_message: 'Amount is too low.',
    detail: { non_field_errors: [leaf] },
})

describe('resolveRampQuoteLimits', () => {
    it('extracts both limits from the canonical payload', () => {
        const limits = resolveRampQuoteLimits(sourceAmountIsTooLowError)

        expect(limits?.min?.toString()).toBe('10')
        expect(limits?.max?.toString()).toBe('5000')
    })

    it('extracts a min-only payload with a null max', () => {
        const limits = resolveRampQuoteLimits(
            buildTooLowError("{'message': 'Too low.', 'min_amount': '600.00'}"),
        )

        expect(limits?.min?.toString()).toBe('600')
        expect(limits?.max).toBeNull()
    })

    it('extracts a max-only payload with a null min', () => {
        const limits = resolveRampQuoteLimits(
            buildTooLowError(
                "{'message': 'Too high.', 'max_amount': '5000.00'}",
            ),
        )

        expect(limits?.min).toBeNull()
        expect(limits?.max?.toString()).toBe('5000')
    })

    it('returns null when the leaf is malformed', () => {
        // An apostrophe inside the message corrupts the quote normalisation.
        const limits = resolveRampQuoteLimits(
            buildTooLowError(
                "{'message': 'isn't allowed', 'min_amount': '600.00'}",
            ),
        )

        expect(limits).toBeNull()
    })

    it('returns null when no amount is parseable', () => {
        const limits = resolveRampQuoteLimits(
            buildTooLowError("{'message': 'Too low.', 'min_amount': 'abc'}"),
        )

        expect(limits).toBeNull()
    })

    it('resolves through a ky HTTPError .data wrapper', () => {
        const limits = resolveRampQuoteLimits({
            name: 'HTTPError',
            status: 400,
            data: sourceAmountIsTooLowError,
        })

        expect(limits?.min?.toString()).toBe('10')
    })

    it('resolves through a PeraNetworkError wrapper', () => {
        const wrapped = new PeraNetworkError('client', {
            status: 400,
            originalError: Object.assign(new Error('http'), {
                data: sourceAmountIsTooLowError,
            }),
        })

        expect(resolveRampQuoteLimits(wrapped)?.min?.toString()).toBe('10')
    })

    it('returns null for other Pera exception types', () => {
        expect(
            resolveRampQuoteLimits({
                type: 'SomeOtherError',
                fallback_message: 'Nope.',
                detail: {},
            }),
        ).toBeNull()
    })

    it('returns null for plain errors and non-error values', () => {
        expect(resolveRampQuoteLimits(new Error('boom'))).toBeNull()
        expect(resolveRampQuoteLimits(undefined)).toBeNull()
        expect(resolveRampQuoteLimits(null)).toBeNull()
    })
})
