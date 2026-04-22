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
    mapMultiSigAccount,
    mapTransactionList,
    mapSignRequest,
} from '../mappers'
import type {
    MultiSigAccountResponse,
    TransactionListResponse,
    SignRequestResponse,
} from '../api/schema'

describe('mapMultiSigAccount', () => {
    test('maps all fields from response to model', () => {
        const response: MultiSigAccountResponse = {
            custom_id: 'msig-123',
            creation_datetime: '2025-01-15T10:30:00Z',
            address: 'MSIG_ADDR_ABC123',
            version: 1,
            threshold: 2,
            participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
        }

        const result = mapMultiSigAccount(response)

        expect(result.customId).toBe('msig-123')
        expect(result.createdAt).toEqual(new Date('2025-01-15T10:30:00Z'))
        expect(result.address).toBe('MSIG_ADDR_ABC123')
        expect(result.version).toBe(1)
        expect(result.threshold).toBe(2)
        expect(result.participantAddresses).toEqual(['ADDR1', 'ADDR2', 'ADDR3'])
    })

    test('handles empty participant_addresses', () => {
        const response: MultiSigAccountResponse = {
            custom_id: 'msig-empty',
            creation_datetime: '2025-01-01T00:00:00Z',
            address: 'MSIG_EMPTY',
            version: 1,
            threshold: 1,
            participant_addresses: [],
        }

        const result = mapMultiSigAccount(response)

        expect(result.participantAddresses).toEqual([])
    })

    test('converts creation_datetime string to Date object', () => {
        const response: MultiSigAccountResponse = {
            custom_id: 'test',
            creation_datetime: '2025-06-15T14:45:30.123Z',
            address: 'ADDR',
            version: 1,
            threshold: 1,
            participant_addresses: [],
        }

        const result = mapMultiSigAccount(response)

        expect(result.createdAt).toBeInstanceOf(Date)
        expect(result.createdAt.toISOString()).toBe('2025-06-15T14:45:30.123Z')
    })
})

describe('mapTransactionList', () => {
    test('maps all fields from response to model', () => {
        const response: TransactionListResponse = {
            id: 'txlist-456',
            raw_transactions: ['tx1_base64', 'tx2_base64'],
            first_valid_block: 1000,
            last_valid_block: 2000,
            expected_expire_datetime: '2025-01-20T12:00:00Z',
            responses: [
                { address: 'ADDR1', response: 'signed' },
                { address: 'ADDR2', response: 'declined' },
            ],
        }

        const result = mapTransactionList(response)

        expect(result.id).toBe('txlist-456')
        expect(result.rawTransactions).toEqual(['tx1_base64', 'tx2_base64'])
        expect(result.firstValidBlock).toBe(1000)
        expect(result.lastValidBlock).toBe(2000)
        expect(result.expectedExpireDatetime).toEqual(
            new Date('2025-01-20T12:00:00Z'),
        )
        expect(result.responses).toEqual([
            { address: 'ADDR1', response: 'signed' },
            { address: 'ADDR2', response: 'declined' },
        ])
    })

    test('handles empty transactions and responses', () => {
        const response: TransactionListResponse = {
            id: 'empty',
            raw_transactions: [],
            first_valid_block: 0,
            last_valid_block: 0,
            expected_expire_datetime: '2025-01-01T00:00:00Z',
            responses: [],
        }

        const result = mapTransactionList(response)

        expect(result.rawTransactions).toEqual([])
        expect(result.responses).toEqual([])
    })

    test('converts expected_expire_datetime string to Date object', () => {
        const response: TransactionListResponse = {
            id: 'test',
            raw_transactions: [],
            first_valid_block: 100,
            last_valid_block: 200,
            expected_expire_datetime: '2025-12-31T23:59:59.999Z',
            responses: [],
        }

        const result = mapTransactionList(response)

        expect(result.expectedExpireDatetime).toBeInstanceOf(Date)
        expect(result.expectedExpireDatetime.toISOString()).toBe(
            '2025-12-31T23:59:59.999Z',
        )
    })
})

describe('mapSignRequest', () => {
    const baseAccountResponse: MultiSigAccountResponse = {
        custom_id: 'msig-1',
        creation_datetime: '2025-01-01T00:00:00Z',
        address: 'MSIG_ADDR',
        version: 1,
        threshold: 2,
        participant_addresses: ['ADDR1', 'ADDR2'],
    }

    const baseTransactionListResponse: TransactionListResponse = {
        id: 'txlist-1',
        raw_transactions: ['tx_data'],
        first_valid_block: 100,
        last_valid_block: 200,
        expected_expire_datetime: '2025-01-02T00:00:00Z',
        responses: [{ address: 'ADDR1', response: 'signed' }],
    }

    test('maps all fields from response to model', () => {
        const response: SignRequestResponse = {
            id: 'sr-789',
            status: 'pending',
            type: 'async',
            creation_datetime: '2025-01-15T10:00:00Z',
            expected_expire_datetime: '2025-01-16T10:00:00Z',
            fail_reason_display: null,
            joint_account: baseAccountResponse,
            transaction_lists: [baseTransactionListResponse],
        }

        const result = mapSignRequest(response)

        expect(result.id).toBe('sr-789')
        expect(result.status).toBe('pending')
        expect(result.type).toBe('async')
        expect(result.createdAt).toEqual(new Date('2025-01-15T10:00:00Z'))
        expect(result.expectedExpireDatetime).toEqual(
            new Date('2025-01-16T10:00:00Z'),
        )
        expect(result.failReasonDisplay).toBeNull()
    })

    test('maps nested joint_account using mapMultiSigAccount', () => {
        const response: SignRequestResponse = {
            id: 'sr-1',
            status: 'ready',
            type: 'sync',
            creation_datetime: '2025-01-01T00:00:00Z',
            expected_expire_datetime: '2025-01-02T00:00:00Z',
            fail_reason_display: null,
            joint_account: baseAccountResponse,
            transaction_lists: [],
        }

        const result = mapSignRequest(response)

        expect(result.multisigAccount.customId).toBe('msig-1')
        expect(result.multisigAccount.address).toBe('MSIG_ADDR')
        expect(result.multisigAccount.threshold).toBe(2)
        expect(result.multisigAccount.participantAddresses).toEqual([
            'ADDR1',
            'ADDR2',
        ])
        expect(result.multisigAccount.createdAt).toBeInstanceOf(Date)
    })

    test('maps transaction_lists using mapTransactionList', () => {
        const response: SignRequestResponse = {
            id: 'sr-2',
            status: 'pending',
            type: 'async',
            creation_datetime: '2025-01-01T00:00:00Z',
            expected_expire_datetime: '2025-01-02T00:00:00Z',
            fail_reason_display: null,
            joint_account: baseAccountResponse,
            transaction_lists: [
                baseTransactionListResponse,
                {
                    ...baseTransactionListResponse,
                    id: 'txlist-2',
                    raw_transactions: ['tx_a', 'tx_b'],
                },
            ],
        }

        const result = mapSignRequest(response)

        expect(result.transactionLists).toHaveLength(2)
        expect(result.transactionLists[0].id).toBe('txlist-1')
        expect(result.transactionLists[1].id).toBe('txlist-2')
        expect(result.transactionLists[1].rawTransactions).toEqual([
            'tx_a',
            'tx_b',
        ])
    })

    test('handles empty transaction_lists', () => {
        const response: SignRequestResponse = {
            id: 'sr-empty',
            status: 'declined',
            type: 'async',
            creation_datetime: '2025-01-01T00:00:00Z',
            expected_expire_datetime: '2025-01-02T00:00:00Z',
            fail_reason_display: null,
            joint_account: baseAccountResponse,
            transaction_lists: [],
        }

        const result = mapSignRequest(response)

        expect(result.transactionLists).toEqual([])
    })

    test('handles fail_reason_display when present', () => {
        const response: SignRequestResponse = {
            id: 'sr-failed',
            status: 'failed',
            type: 'async',
            creation_datetime: '2025-01-01T00:00:00Z',
            expected_expire_datetime: '2025-01-02T00:00:00Z',
            fail_reason_display: 'Transaction expired before all signatures',
            joint_account: baseAccountResponse,
            transaction_lists: [],
        }

        const result = mapSignRequest(response)

        expect(result.failReasonDisplay).toBe(
            'Transaction expired before all signatures',
        )
    })

    test('handles all status types', () => {
        const statuses = [
            'pending',
            'ready',
            'submitting',
            'confirmed',
            'failed',
            'expired',
            'declined',
        ] as const

        statuses.forEach(status => {
            const response: SignRequestResponse = {
                id: `sr-${status}`,
                status,
                type: 'async',
                creation_datetime: '2025-01-01T00:00:00Z',
                expected_expire_datetime: '2025-01-02T00:00:00Z',
                fail_reason_display: null,
                joint_account: baseAccountResponse,
                transaction_lists: [],
            }

            const result = mapSignRequest(response)

            expect(result.status).toBe(status)
        })
    })
})
