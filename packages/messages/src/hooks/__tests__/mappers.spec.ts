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
import {
    mapMultiSigAccount,
    mapTransactionList,
    mapSignRequest,
    mapASAInbox,
    mapInboxResponse,
} from '../mappers'
import type {
    MultiSigAccountResponse,
    TransactionListResponse,
    SignRequestResponse,
    ASAInboxResponse,
    InboxResponse,
} from '../../api/inbox'

describe('mappers', () => {
    describe('mapMultiSigAccount', () => {
        it('should map snake_case response to camelCase model', () => {
            const response: MultiSigAccountResponse = {
                custom_id: 'msig-123',
                creation_datetime: '2025-01-15T10:30:00Z',
                address: 'MSIG_ADDR_ABC',
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
            }

            const result = mapMultiSigAccount(response)

            expect(result).toEqual({
                customId: 'msig-123',
                createdAt: new Date('2025-01-15T10:30:00Z'),
                address: 'MSIG_ADDR_ABC',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
            })
        })

        it('should convert creation_datetime string to Date object', () => {
            const response: MultiSigAccountResponse = {
                custom_id: 'msig-1',
                creation_datetime: '2025-06-20T14:45:30Z',
                address: 'ADDR',
                version: 1,
                threshold: 1,
                participant_addresses: [],
            }

            const result = mapMultiSigAccount(response)

            expect(result.createdAt).toBeInstanceOf(Date)
            expect(result.createdAt.toISOString()).toBe(
                '2025-06-20T14:45:30.000Z',
            )
        })
    })

    describe('mapTransactionList', () => {
        it('should map snake_case response to camelCase model', () => {
            const response: TransactionListResponse = {
                id: 'txn-list-1',
                raw_transactions: ['txn1', 'txn2'],
                first_valid_block: 1000,
                last_valid_block: 2000,
                expected_expire_datetime: '2025-01-21T00:00:00Z',
                responses: [
                    { address: 'ADDR1', response: 'signed' },
                    { address: 'ADDR2', response: 'declined' },
                ],
            }

            const result = mapTransactionList(response)

            expect(result).toEqual({
                id: 'txn-list-1',
                rawTransactions: ['txn1', 'txn2'],
                firstValidBlock: 1000,
                lastValidBlock: 2000,
                expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
                responses: [
                    { address: 'ADDR1', response: 'signed' },
                    { address: 'ADDR2', response: 'declined' },
                ],
            })
        })

        it('should convert expected_expire_datetime string to Date object', () => {
            const response: TransactionListResponse = {
                id: '1',
                raw_transactions: [],
                first_valid_block: 100,
                last_valid_block: 200,
                expected_expire_datetime: '2025-12-31T23:59:59Z',
                responses: [],
            }

            const result = mapTransactionList(response)

            expect(result.expectedExpireDatetime).toBeInstanceOf(Date)
            expect(result.expectedExpireDatetime.toISOString()).toBe(
                '2025-12-31T23:59:59.000Z',
            )
        })
    })

    describe('mapSignRequest', () => {
        const createMockSignRequestResponse = (
            overrides: Partial<SignRequestResponse> = {},
        ): SignRequestResponse => ({
            id: 'sign-req-1',
            status: 'pending',
            type: 'transfer',
            creation_datetime: '2025-01-20T00:00:00Z',
            expected_expire_datetime: '2025-01-21T00:00:00Z',
            fail_reason_display: null,
            joint_account: {
                custom_id: 'msig-1',
                creation_datetime: '2025-01-10T00:00:00Z',
                address: 'MSIG_ADDR',
                version: 1,
                threshold: 2,
                participant_addresses: ['ADDR1', 'ADDR2'],
            },
            transaction_lists: [],
            ...overrides,
        })

        it('should map snake_case response to camelCase model', () => {
            const response = createMockSignRequestResponse()

            const result = mapSignRequest(response)

            expect(result.id).toBe('sign-req-1')
            expect(result.status).toBe('pending')
            expect(result.type).toBe('transfer')
            expect(result.failReasonDisplay).toBeNull()
        })

        it('should convert datetime strings to Date objects', () => {
            const response = createMockSignRequestResponse()

            const result = mapSignRequest(response)

            expect(result.createdAt).toBeInstanceOf(Date)
            expect(result.createdAt.toISOString()).toBe(
                '2025-01-20T00:00:00.000Z',
            )
            expect(result.expectedExpireDatetime).toBeInstanceOf(Date)
            expect(result.expectedExpireDatetime.toISOString()).toBe(
                '2025-01-21T00:00:00.000Z',
            )
        })

        it('should map nested joint_account using mapMultiSigAccount', () => {
            const response = createMockSignRequestResponse()

            const result = mapSignRequest(response)

            expect(result.multisigAccount).toEqual({
                customId: 'msig-1',
                createdAt: new Date('2025-01-10T00:00:00Z'),
                address: 'MSIG_ADDR',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            })
        })

        it('should map transaction_lists using mapTransactionList', () => {
            const response = createMockSignRequestResponse({
                transaction_lists: [
                    {
                        id: 'txn-1',
                        raw_transactions: ['raw1'],
                        first_valid_block: 100,
                        last_valid_block: 200,
                        expected_expire_datetime: '2025-01-21T00:00:00Z',
                        responses: [{ address: 'ADDR1', response: 'signed' }],
                    },
                    {
                        id: 'txn-2',
                        raw_transactions: ['raw2', 'raw3'],
                        first_valid_block: 150,
                        last_valid_block: 250,
                        expected_expire_datetime: '2025-01-22T00:00:00Z',
                        responses: [],
                    },
                ],
            })

            const result = mapSignRequest(response)

            expect(result.transactionLists).toHaveLength(2)
            expect(result.transactionLists[0]).toEqual({
                id: 'txn-1',
                rawTransactions: ['raw1'],
                firstValidBlock: 100,
                lastValidBlock: 200,
                expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
                responses: [{ address: 'ADDR1', response: 'signed' }],
            })
            expect(result.transactionLists[1].id).toBe('txn-2')
        })

        it('should preserve fail_reason_display when present', () => {
            const response = createMockSignRequestResponse({
                status: 'failed',
                fail_reason_display: 'Insufficient funds',
            })

            const result = mapSignRequest(response)

            expect(result.failReasonDisplay).toBe('Insufficient funds')
        })
    })

    describe('mapASAInbox', () => {
        it('should map snake_case response to camelCase model', () => {
            const response: ASAInboxResponse = {
                address: 'ACCOUNT_ADDR',
                inbox_address: 'INBOX_ADDR',
                request_count: 5,
            }

            const result = mapASAInbox(response)

            expect(result).toEqual({
                address: 'ACCOUNT_ADDR',
                inboxAddress: 'INBOX_ADDR',
                requestCount: 5,
            })
        })

        it('should handle null inbox_address', () => {
            const response: ASAInboxResponse = {
                address: 'ACCOUNT_ADDR',
                inbox_address: null,
                request_count: 0,
            }

            const result = mapASAInbox(response)

            expect(result.inboxAddress).toBeNull()
        })
    })

    describe('mapInboxResponse', () => {
        it('should return empty array when response has no items', () => {
            const response: InboxResponse = {
                joint_account_import_requests: [],
                joint_account_sign_requests: [],
                asa_inboxes: [],
            }

            const result = mapInboxResponse(response)

            expect(result).toEqual([])
        })

        it('should map joint_account_import_requests to InboxItems', () => {
            const response: InboxResponse = {
                joint_account_import_requests: [
                    {
                        custom_id: 'msig-1',
                        creation_datetime: '2025-01-15T00:00:00Z',
                        address: 'MSIG_ADDR',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['ADDR1', 'ADDR2'],
                    },
                ],
                joint_account_sign_requests: [],
                asa_inboxes: [],
            }

            const result = mapInboxResponse(response)

            expect(result).toHaveLength(1)
            expect(result[0].type).toBe('multisig_import')
            expect(result[0].createdAt).toEqual(
                new Date('2025-01-15T00:00:00Z'),
            )
            expect(result[0].data).toEqual({
                customId: 'msig-1',
                createdAt: new Date('2025-01-15T00:00:00Z'),
                address: 'MSIG_ADDR',
                version: 1,
                threshold: 2,
                participantAddresses: ['ADDR1', 'ADDR2'],
            })
        })

        it('should map joint_account_sign_requests to InboxItems', () => {
            const response: InboxResponse = {
                joint_account_import_requests: [],
                joint_account_sign_requests: [
                    {
                        id: 'sign-1',
                        status: 'pending',
                        type: 'transfer',
                        creation_datetime: '2025-01-20T00:00:00Z',
                        expected_expire_datetime: '2025-01-21T00:00:00Z',
                        fail_reason_display: null,
                        joint_account: {
                            custom_id: 'msig-1',
                            creation_datetime: '2025-01-10T00:00:00Z',
                            address: 'MSIG_ADDR',
                            version: 1,
                            threshold: 2,
                            participant_addresses: ['ADDR1', 'ADDR2'],
                        },
                        transaction_lists: [],
                    },
                ],
                asa_inboxes: [],
            }

            const result = mapInboxResponse(response)

            expect(result).toHaveLength(1)
            expect(result[0].type).toBe('multisig_sign')
            expect(result[0].createdAt).toEqual(
                new Date('2025-01-20T00:00:00Z'),
            )
        })

        it('should map asa_inboxes to InboxItems with epoch 0 createdAt', () => {
            const response: InboxResponse = {
                joint_account_import_requests: [],
                joint_account_sign_requests: [],
                asa_inboxes: [
                    {
                        address: 'ADDR1',
                        inbox_address: 'INBOX1',
                        request_count: 3,
                    },
                ],
            }

            const result = mapInboxResponse(response)

            expect(result).toHaveLength(1)
            expect(result[0].type).toBe('asa_inbox')
            expect(result[0].createdAt).toEqual(new Date(0))
            expect(result[0].data).toEqual({
                address: 'ADDR1',
                inboxAddress: 'INBOX1',
                requestCount: 3,
            })
        })

        it('should combine all item types in the result array', () => {
            const response: InboxResponse = {
                joint_account_import_requests: [
                    {
                        custom_id: 'msig-1',
                        creation_datetime: '2025-01-15T00:00:00Z',
                        address: 'MSIG_ADDR1',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['ADDR1'],
                    },
                    {
                        custom_id: 'msig-2',
                        creation_datetime: '2025-01-16T00:00:00Z',
                        address: 'MSIG_ADDR2',
                        version: 1,
                        threshold: 2,
                        participant_addresses: ['ADDR2'],
                    },
                ],
                joint_account_sign_requests: [
                    {
                        id: 'sign-1',
                        status: 'pending',
                        type: 'transfer',
                        creation_datetime: '2025-01-20T00:00:00Z',
                        expected_expire_datetime: '2025-01-21T00:00:00Z',
                        fail_reason_display: null,
                        joint_account: {
                            custom_id: 'msig-3',
                            creation_datetime: '2025-01-10T00:00:00Z',
                            address: 'MSIG_ADDR3',
                            version: 1,
                            threshold: 2,
                            participant_addresses: ['ADDR1', 'ADDR2'],
                        },
                        transaction_lists: [],
                    },
                ],
                asa_inboxes: [
                    {
                        address: 'ADDR1',
                        inbox_address: 'INBOX1',
                        request_count: 3,
                    },
                    {
                        address: 'ADDR2',
                        inbox_address: 'INBOX2',
                        request_count: 1,
                    },
                ],
            }

            const result = mapInboxResponse(response)

            expect(result).toHaveLength(5)
            expect(
                result.filter(item => item.type === 'multisig_import'),
            ).toHaveLength(2)
            expect(
                result.filter(item => item.type === 'multisig_sign'),
            ).toHaveLength(1)
            expect(
                result.filter(item => item.type === 'asa_inbox'),
            ).toHaveLength(2)
        })
    })
})
