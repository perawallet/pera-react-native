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
    multiSigAccountResponseSchema,
    signResponseSchema,
    transactionListResponseSchema,
    signRequestResponseSchema,
    asaInboxResponseSchema,
    inboxResponseSchema,
} from '../schema'

describe('multiSigAccountResponseSchema', () => {
    const validAccount = {
        custom_id: 'msig-1',
        creation_datetime: '2025-01-01T00:00:00Z',
        address: 'TESTADDR123',
        version: 1,
        threshold: 2,
        participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
    }

    test('parses a valid multi-sig account', () => {
        const result = multiSigAccountResponseSchema.parse(validAccount)
        expect(result).toEqual(validAccount)
    })

    test('rejects missing required fields', () => {
        expect(() =>
            multiSigAccountResponseSchema.parse({ custom_id: 'msig-1' }),
        ).toThrow()
    })

    test('rejects non-array participant_addresses', () => {
        expect(() =>
            multiSigAccountResponseSchema.parse({
                ...validAccount,
                participant_addresses: 'not-an-array',
            }),
        ).toThrow()
    })
})

describe('signResponseSchema', () => {
    test('parses a valid signed response', () => {
        const input = { address: 'ADDR1', response: 'signed' }
        const result = signResponseSchema.parse(input)
        expect(result).toEqual(input)
    })

    test('parses a valid declined response', () => {
        const input = { address: 'ADDR1', response: 'declined' }
        const result = signResponseSchema.parse(input)
        expect(result.response).toBe('declined')
    })

    test('rejects invalid response value', () => {
        expect(() =>
            signResponseSchema.parse({ address: 'ADDR1', response: 'unknown' }),
        ).toThrow()
    })
})

describe('transactionListResponseSchema', () => {
    const validTxList = {
        id: '1',
        raw_transactions: ['tx1', 'tx2'],
        first_valid_block: 100,
        last_valid_block: 200,
        expected_expire_datetime: '2025-01-02T00:00:00Z',
        responses: [{ address: 'ADDR1', response: 'signed' }],
    }

    test('parses a valid transaction list', () => {
        const result = transactionListResponseSchema.parse(validTxList)
        expect(result.id).toBe('1')
        expect(result.responses).toHaveLength(1)
    })

    test('coerces numeric id to string', () => {
        const input = { ...validTxList, id: 42 }
        const result = transactionListResponseSchema.parse(input)
        expect(result.id).toBe('42')
    })

    test('rejects missing responses', () => {
        const { responses: _, ...withoutResponses } = validTxList
        expect(() =>
            transactionListResponseSchema.parse(withoutResponses),
        ).toThrow()
    })
})

describe('signRequestResponseSchema', () => {
    const validSignRequest = {
        id: '1',
        status: 'pending',
        type: 'transfer',
        creation_datetime: '2025-01-01T00:00:00Z',
        expected_expire_datetime: '2025-01-02T00:00:00Z',
        fail_reason_display: null,
        joint_account: {
            custom_id: 'msig-1',
            creation_datetime: '2025-01-01T00:00:00Z',
            address: 'TESTADDR123',
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR1', 'ADDR2'],
        },
        transaction_lists: [],
    }

    test('parses a valid sign request', () => {
        const result = signRequestResponseSchema.parse(validSignRequest)
        expect(result.status).toBe('pending')
        expect(result.fail_reason_display).toBeNull()
    })

    test('parses all valid status values', () => {
        const statuses = [
            'pending',
            'ready',
            'submitting',
            'confirmed',
            'failed',
            'expired',
            'declined',
        ]
        for (const status of statuses) {
            const result = signRequestResponseSchema.parse({
                ...validSignRequest,
                status,
            })
            expect(result.status).toBe(status)
        }
    })

    test('rejects invalid status', () => {
        expect(() =>
            signRequestResponseSchema.parse({
                ...validSignRequest,
                status: 'invalid',
            }),
        ).toThrow()
    })

    test('parses with non-null fail_reason_display', () => {
        const result = signRequestResponseSchema.parse({
            ...validSignRequest,
            fail_reason_display: 'Timed out',
        })
        expect(result.fail_reason_display).toBe('Timed out')
    })
})

describe('asaInboxResponseSchema', () => {
    test('parses a valid ASA inbox', () => {
        const input = {
            address: 'TESTADDR',
            inbox_address: 'INBOX_ADDR',
            request_count: 3,
        }
        const result = asaInboxResponseSchema.parse(input)
        expect(result).toEqual(input)
    })

    test('parses with null inbox_address', () => {
        const input = {
            address: 'TESTADDR',
            inbox_address: null,
            request_count: 0,
        }
        const result = asaInboxResponseSchema.parse(input)
        expect(result.inbox_address).toBeNull()
    })

    test('rejects missing request_count', () => {
        expect(() =>
            asaInboxResponseSchema.parse({
                address: 'TESTADDR',
                inbox_address: null,
            }),
        ).toThrow()
    })
})

describe('inboxResponseSchema', () => {
    const validInbox = {
        joint_account_import_requests: [],
        joint_account_sign_requests: [],
        asa_inboxes: [],
    }

    test('parses an empty inbox response', () => {
        const result = inboxResponseSchema.parse(validInbox)
        expect(result.joint_account_import_requests).toHaveLength(0)
        expect(result.joint_account_sign_requests).toHaveLength(0)
        expect(result.asa_inboxes).toHaveLength(0)
    })

    test('parses inbox with all item types', () => {
        const input = {
            joint_account_import_requests: [
                {
                    custom_id: 'msig-1',
                    creation_datetime: '2025-01-01T00:00:00Z',
                    address: 'ADDR1',
                    version: 1,
                    threshold: 2,
                    participant_addresses: ['A', 'B'],
                },
            ],
            joint_account_sign_requests: [
                {
                    id: '1',
                    status: 'pending',
                    type: 'transfer',
                    creation_datetime: '2025-01-01T00:00:00Z',
                    expected_expire_datetime: '2025-01-02T00:00:00Z',
                    fail_reason_display: null,
                    joint_account: {
                        custom_id: 'msig-1',
                        creation_datetime: '2025-01-01T00:00:00Z',
                        address: 'ADDR1',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['A', 'B'],
                    },
                    transaction_lists: [],
                },
            ],
            asa_inboxes: [
                {
                    address: 'ADDR1',
                    inbox_address: 'INBOX1',
                    request_count: 5,
                },
            ],
        }
        const result = inboxResponseSchema.parse(input)
        expect(result.joint_account_import_requests).toHaveLength(1)
        expect(result.joint_account_sign_requests).toHaveLength(1)
        expect(result.asa_inboxes).toHaveLength(1)
    })

    test('rejects missing required arrays', () => {
        expect(() => inboxResponseSchema.parse({})).toThrow()
    })
})
