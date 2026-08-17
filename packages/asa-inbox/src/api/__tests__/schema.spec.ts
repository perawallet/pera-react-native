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
    arc59AssetRequestsResponseSchema,
    mapArc59AssetRequest,
    MAX_ARC59_FUNDING_MICRO_ALGO,
    type Arc59AssetRequestResponse,
} from '../schema'
import { getArc59SignedFundingAmount } from '../../getArc59SignedFundingAmount'

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

    // PERA-4710: the signed payment = algo_fund_amount + minimum_balance_requirement
    // must be bounded well below MAX_SAFE_INTEGER so a hostile summary can't
    // drain the account through the headless signature.
    test('rejects an algo_fund_amount above the funding ceiling', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                algo_fund_amount: MAX_ARC59_FUNDING_MICRO_ALGO + 1,
            }),
        ).toThrow()
    })

    test('rejects a minimum_balance_requirement above the funding ceiling', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                minimum_balance_requirement: MAX_ARC59_FUNDING_MICRO_ALGO + 1,
            }),
        ).toThrow()
    })

    test('rejects two individually-legal amounts whose SUM exceeds the ceiling', () => {
        // Regression: bounding each field separately admitted 2 × the limit,
        // and the sum is what the wallet actually signs.
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                algo_fund_amount: MAX_ARC59_FUNDING_MICRO_ALGO,
                minimum_balance_requirement: 1,
            }),
        ).toThrow()
    })

    test('accepts a funding total exactly at the ceiling', () => {
        expect(() =>
            arc59SendSummaryResponseSchema.parse({
                ...validSummary,
                algo_fund_amount: MAX_ARC59_FUNDING_MICRO_ALGO - 1,
                minimum_balance_requirement: 1,
            }),
        ).not.toThrow()
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

describe('getArc59SignedFundingAmount', () => {
    test('sums algo_fund_amount and minimum_balance_requirement as µAlgo', () => {
        expect(
            getArc59SignedFundingAmount({
                algo_fund_amount: 200_000,
                minimum_balance_requirement: 100_000,
            }),
        ).toBe(300_000n)
    })
})

const INBOX_ADDRESS =
    'OJVMSUIFJXMRWFSFG2CPPWMFTWXRXN3J42PZATE24FVKU4Q43DPCZXEA24'

const validRawAssetRequest: Arc59AssetRequestResponse = {
    total_amount: '1000',
    asset: {
        asset_id: '12345',
        name: 'Test Asset',
        logo: null,
        unit_name: 'TEST',
        fraction_decimals: 6,
        usd_value: null,
        verification_tier: 'trusted',
        is_verified: true,
        is_deleted: false,
        creator: { address: 'CREATOR' },
        type: 'standard_asset' as const,
    },
    algo_gain_on_claim: '0',
    algo_gain_on_reject: '0',
    senders: {
        count: 1,
        results: [
            {
                sender: { address: 'SENDER1', name: 'Alice' },
                amount: '500',
            },
        ],
    },
    insufficient_algo_for_claiming: false,
    insufficient_algo_for_rejecting: false,
    should_use_funds_before_claiming: false,
    should_use_funds_before_rejecting: false,
}

describe('arc59AssetRequestsResponseSchema', () => {
    test('parses a response with a top-level inbox_address', () => {
        const result = arc59AssetRequestsResponseSchema.parse({
            results: [validRawAssetRequest],
            inbox_address: INBOX_ADDRESS,
        })

        expect(result.inbox_address).toBe(INBOX_ADDRESS)
    })

    test('parses a response with a null inbox_address', () => {
        const result = arc59AssetRequestsResponseSchema.parse({
            results: [validRawAssetRequest],
            inbox_address: null,
        })

        expect(result.inbox_address).toBeNull()
    })

    test('parses a response missing inbox_address (older backend)', () => {
        const result = arc59AssetRequestsResponseSchema.parse({
            results: [validRawAssetRequest],
        })

        expect(result.inbox_address).toBeUndefined()
    })
})

describe('mapArc59AssetRequest', () => {
    test('sets inboxAddress from the provided value on every request', () => {
        const result = mapArc59AssetRequest(validRawAssetRequest, INBOX_ADDRESS)

        expect(result.inboxAddress).toBe(INBOX_ADDRESS)
    })

    test('defaults inboxAddress to null when none is provided', () => {
        const result = mapArc59AssetRequest(validRawAssetRequest)

        expect(result.inboxAddress).toBeNull()
    })

    test('maps the wire asset type into peraMetadata.type', () => {
        const result = mapArc59AssetRequest(validRawAssetRequest)

        expect(result.asset.peraMetadata?.type).toBe('standard_asset')
    })

    test('maps a collectible request so isCollectible-style checks work', () => {
        const rawCollectibleRequest: Arc59AssetRequestResponse = {
            ...validRawAssetRequest,
            asset: {
                ...validRawAssetRequest.asset,
                type: 'collectible',
                collectible: {
                    title: 'GEMS NFT 1',
                    primary_image: 'https://example.com/nft.png',
                },
            },
        }

        const result = mapArc59AssetRequest(rawCollectibleRequest)

        expect(result.asset.peraMetadata?.type).toBe('collectible')
        expect(result.asset.peraMetadata?.collectible).toEqual({
            title: 'GEMS NFT 1',
            primaryImage: 'https://example.com/nft.png',
        })
    })
})
