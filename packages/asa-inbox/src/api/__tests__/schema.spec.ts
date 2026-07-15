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

import { describe, test, expect } from 'vitest'
import {
    arc59SendSummaryResponseSchema,
    arc59WarningMessageSchema,
} from '../schema'

describe('arc59WarningMessageSchema', () => {
    test('parses a valid warning message', () => {
        const input = {
            title: 'Warning',
            detail: 'This is a warning',
            link: 'https://example.com',
            link_text: 'Learn more',
        }

        const result = arc59WarningMessageSchema.parse(input)

        expect(result).toEqual(input)
    })

    test('rejects missing fields', () => {
        expect(() =>
            arc59WarningMessageSchema.parse({ title: 'Warning' }),
        ).toThrow()
    })

    test('rejects non-string fields', () => {
        expect(() =>
            arc59WarningMessageSchema.parse({
                title: 123,
                detail: 'detail',
                link: 'link',
                link_text: 'text',
            }),
        ).toThrow()
    })
})

describe('arc59SendSummaryResponseSchema', () => {
    const validSummary = {
        is_arc59_opted_in: true,
        minimum_balance_requirement: 100000,
        inner_tx_count: 3,
        total_protocol_and_mbr_fee: 5000,
        inbox_address: 'TESTINBOXADDRESS',
        algo_fund_amount: 200000,
        warning_message: null,
    }

    test('parses a valid summary with null warning and inbox', () => {
        const result = arc59SendSummaryResponseSchema.parse({
            ...validSummary,
            inbox_address: null,
        })

        expect(result.is_arc59_opted_in).toBe(true)
        expect(result.inbox_address).toBeNull()
        expect(result.warning_message).toBeNull()
    })

    test('parses a valid summary with warning message', () => {
        const input = {
            ...validSummary,
            warning_message: {
                title: 'Warning',
                detail: 'Detail',
                link: 'https://example.com',
                link_text: 'Learn more',
            },
        }

        const result = arc59SendSummaryResponseSchema.parse(input)

        expect(result.warning_message).toEqual(input.warning_message)
    })

    test('parses a valid summary with inbox address', () => {
        const result = arc59SendSummaryResponseSchema.parse(validSummary)

        expect(result.inbox_address).toBe('TESTINBOXADDRESS')
    })

    test('rejects missing required fields', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                is_arc59_opted_in: true,
            }),
        ).toThrow()
    })

    test('rejects wrong types for boolean field', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                is_arc59_opted_in: 'yes',
            }),
        ).toThrow()
    })

    test('rejects wrong types for number fields', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                inner_tx_count: '3',
            }),
        ).toThrow()
    })

    test('rejects non-null non-object warning_message', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                warning_message: 'not an object',
            }),
        ).toThrow()
    })

    test.each([
        'minimum_balance_requirement',
        'inner_tx_count',
        'total_protocol_and_mbr_fee',
        'algo_fund_amount',
    ] as const)('rejects a fractional %s (would crash BigInt())', field => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                [field]: 1.5,
            }),
        ).toThrow()
    })

    test.each(['minimum_balance_requirement', 'algo_fund_amount'] as const)(
        'rejects a negative %s',
        field => {
            expect(() =>
                arc59SendSummaryResponseSchema.parse({
                    ...validSummary,
                    [field]: -1,
                }),
            ).toThrow()
        },
    )

    test('rejects an amount beyond safe-integer precision', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                algo_fund_amount: Number.MAX_SAFE_INTEGER + 2,
            }),
        ).toThrow()
    })
})
