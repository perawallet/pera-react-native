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

import { describe, test, expect } from 'vitest'
import {
    createMultisigAccountRequestSchema,
    proposeSignRequestSchema,
    addSignatureRequestSchema,
    declineRequestSchema,
    signRequestResponseSchema,
    transactionListResponseSchema,
} from '../schema'

describe('createMultisigAccountRequestSchema', () => {
    const validRequest = {
        version: 1,
        threshold: 2,
        participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
        device_id: 'device-123',
    }

    test('parses a valid create request', () => {
        const result = createMultisigAccountRequestSchema.parse(validRequest)
        expect(result).toEqual(validRequest)
    })

    test('rejects missing device_id', () => {
        const { device_id: _, ...without } = validRequest
        expect(() =>
            createMultisigAccountRequestSchema.parse(without),
        ).toThrow()
    })

    test('rejects missing threshold', () => {
        const { threshold: _, ...without } = validRequest
        expect(() =>
            createMultisigAccountRequestSchema.parse(without),
        ).toThrow()
    })

    test('rejects non-array participant_addresses', () => {
        expect(() =>
            createMultisigAccountRequestSchema.parse({
                ...validRequest,
                participant_addresses: 'not-an-array',
            }),
        ).toThrow()
    })
})

describe('proposeSignRequestSchema', () => {
    const validRequest = {
        joint_account_address: 'MSIG_ADDR',
        proposer_address: 'PROPOSER_ADDR',
        type: 'async',
        raw_transaction_lists: [['tx1_base64', 'tx2_base64']],
        responses: [
            {
                address: 'PROPOSER_ADDR',
                response: 'signed' as const,
                signatures: [['sig1', null]],
            },
        ],
    }

    test('parses a valid propose request', () => {
        const result = proposeSignRequestSchema.parse(validRequest)
        expect(result.joint_account_address).toBe('MSIG_ADDR')
        expect(result.type).toBe('async')
    })

    test('rejects missing raw_transaction_lists', () => {
        const { raw_transaction_lists: _, ...without } = validRequest
        expect(() => proposeSignRequestSchema.parse(without)).toThrow()
    })

    test('rejects invalid response value in responses', () => {
        expect(() =>
            proposeSignRequestSchema.parse({
                ...validRequest,
                responses: [
                    {
                        address: 'ADDR',
                        response: 'invalid',
                        signatures: [['sig']],
                    },
                ],
            }),
        ).toThrow()
    })
})

describe('addSignatureRequestSchema', () => {
    test('parses a valid signed response', () => {
        const input = {
            address: 'ADDR1',
            response: 'signed' as const,
            signatures: [['sig1', 'sig2']],
        }
        const result = addSignatureRequestSchema.parse(input)
        expect(result.address).toBe('ADDR1')
        expect(result.response).toBe('signed')
    })

    test('parses a declined response without signatures', () => {
        const input = {
            address: 'ADDR1',
            response: 'declined' as const,
            device_id: 'device-1',
        }
        const result = addSignatureRequestSchema.parse(input)
        expect(result.response).toBe('declined')
    })

    test('rejects invalid response value', () => {
        expect(() =>
            addSignatureRequestSchema.parse({
                address: 'ADDR1',
                response: 'unknown',
            }),
        ).toThrow()
    })
})

describe('transactionListResponseSchema', () => {
    test('coerces string first_valid_block / last_valid_block to numbers (real backend shape)', () => {
        // Backend returns block heights as strings; coerce.number() unifies them
        // to the domain's numeric representation. Captured from a real
        // POST /v1/inbox/{deviceID}/ response.
        const result = transactionListResponseSchema.parse({
            id: 12345,
            raw_transactions: ['iaNhbXTOAAMNQ...'],
            first_valid_block: '63113487',
            last_valid_block: '63114487',
            responses: [{ address: 'ADDR1', response: 'signed' }],
            expected_expire_datetime: '2026-05-06T15:37:03+0300',
        })

        expect(result.first_valid_block).toBe(63113487)
        expect(result.last_valid_block).toBe(63114487)
        expect(typeof result.first_valid_block).toBe('number')
        expect(typeof result.last_valid_block).toBe('number')
        expect(result.id).toBe('12345')
    })

    test('still accepts numeric first_valid_block / last_valid_block', () => {
        const result = transactionListResponseSchema.parse({
            id: 'txlist-1',
            raw_transactions: [],
            first_valid_block: 1000,
            last_valid_block: 2000,
            responses: [],
            expected_expire_datetime: '2025-01-01T00:00:00Z',
        })

        expect(result.first_valid_block).toBe(1000)
        expect(result.last_valid_block).toBe(2000)
    })
})

describe('signRequestResponseSchema', () => {
    test('parses the real /v1/inbox/{deviceID}/ response payload', () => {
        // Real testnet response captured 2026-05-06; this is the exact shape
        // that was silently failing before the schema fix (block numbers as
        // strings tripped z.number()).
        const realPayload = {
            id: '26cedd3b-8b85-4660-8cdd-3c60ccc335cd',
            joint_account: {
                custom_id: '9b190da9-d551-4e6b-8f4b-34220c4e8ffd',
                creation_datetime: '2026-05-06T14:41:20+0300',
                address:
                    'FESGE7VW2XZ5AQ36UZAYK4T6OKWNKSFBCWWX3YXIDPSEDKMNREVJVCDX2Y',
                version: 1,
                threshold: 2,
                participant_addresses: [
                    'PYD62H4POQJE2VLGZ3W3RGT5CPEJCLMJTEWAXUUNMBK2QA73FA3KHKTXBQ',
                    'U7JK4Q5DA6Q36UN6JYBZK5HZ5B2YZLDMD3TMF67OAX22TD64KNESJRATUY',
                ],
            },
            type: 'async',
            transaction_lists: [
                {
                    id: 12345,
                    raw_transactions: ['iaNhbXTOAAMNQ...'],
                    first_valid_block: '63113487',
                    last_valid_block: '63114487',
                    responses: [
                        {
                            address:
                                'PYD62H4POQJE2VLGZ3W3RGT5CPEJCLMJTEWAXUUNMBK2QA73FA3KHKTXBQ',
                            response: 'signed',
                        },
                    ],
                    expected_expire_datetime: '2026-05-06T15:37:03+0300',
                },
            ],
            expected_expire_datetime: '2026-05-06T15:37:03+0300',
            status: 'pending',
            creation_datetime: '2026-05-06T14:49:21+0300',
            fail_reason_display: null,
        }

        const result = signRequestResponseSchema.parse(realPayload)

        expect(result.id).toBe('26cedd3b-8b85-4660-8cdd-3c60ccc335cd')
        expect(result.status).toBe('pending')
        expect(result.transaction_lists[0]!.first_valid_block).toBe(63113487)
        expect(result.transaction_lists[0]!.last_valid_block).toBe(63114487)
        expect(result.fail_reason_display).toBeNull()
    })
})

describe('declineRequestSchema', () => {
    test('parses a valid decline request', () => {
        const input = {
            address: 'ADDR1',
            response: 'declined' as const,
            device_id: 'device-1',
        }
        const result = declineRequestSchema.parse(input)
        expect(result.address).toBe('ADDR1')
        expect(result.device_id).toBe('device-1')
    })

    test('rejects signed response', () => {
        expect(() =>
            declineRequestSchema.parse({
                address: 'ADDR1',
                response: 'signed',
                device_id: 'device-1',
            }),
        ).toThrow()
    })

    test('rejects missing device_id', () => {
        expect(() =>
            declineRequestSchema.parse({
                address: 'ADDR1',
                response: 'declined',
            }),
        ).toThrow()
    })
})
