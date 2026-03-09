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
} from '../schema'

describe('createMultisigAccountRequestSchema', () => {
    const validRequest = {
        version: 1,
        threshold: 2,
        participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
    }

    test('parses a valid create request', () => {
        const result = createMultisigAccountRequestSchema.parse(validRequest)
        expect(result).toEqual(validRequest)
    })

    test('parses with optional device_id', () => {
        const result = createMultisigAccountRequestSchema.parse({
            ...validRequest,
            device_id: 'device-123',
        })
        expect(result.device_id).toBe('device-123')
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
