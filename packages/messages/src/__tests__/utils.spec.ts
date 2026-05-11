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

import { describe, it, expect } from 'vitest'
import { sortInboxItems } from '../utils'
import type {
    InboxItem,
    MultiSigAccount,
    MultisigSignRequest,
    ASAInbox,
} from '../models'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const createMultiSigAccount = (
    overrides: Partial<MultiSigAccount> = {},
): MultiSigAccount => ({
    customId: 'msig-1',
    createdAt: new Date('2025-01-15T00:00:00Z'),
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participantAddresses: ['ADDR1', 'ADDR2'],
    ...overrides,
})

const createSignRequest = (
    overrides: Partial<MultisigSignRequest> = {},
): MultisigSignRequest => ({
    id: 'sign-1',
    status: 'pending',
    type: 'transfer',
    createdAt: new Date('2025-01-20T00:00:00Z'),
    expectedExpireDatetime: new Date('2025-01-21T00:00:00Z'),
    failReasonDisplay: null,
    proposerAddress: null,
    multisigAccount: createMultiSigAccount(),
    transactionLists: [],
    ...overrides,
})

const createASAInbox = (overrides: Partial<ASAInbox> = {}): ASAInbox => ({
    address: 'ADDR1',
    inboxAddress: 'INBOX1',
    requestCount: 3,
    ...overrides,
})

const createMultisigImportItem = (
    createdAt: Date,
    customId = 'msig-1',
): InboxItem => ({
    type: 'multisig_import',
    data: createMultiSigAccount({ createdAt, customId }),
    createdAt,
})

const createMultisigSignItem = (createdAt: Date, id = 'sign-1'): InboxItem => ({
    type: 'multisig_sign',
    data: createSignRequest({ createdAt, id }),
    createdAt,
})

const createASAInboxItem = (address: string): InboxItem => ({
    type: 'asa_inbox',
    data: createASAInbox({ address }),
    createdAt: new Date(0),
})

const createMockAccounts = (addresses: string[]): WalletAccount[] =>
    addresses.map(address => ({
        address,
        type: 'algo25' as const,
    })) as WalletAccount[]

describe('utils', () => {
    describe('sortInboxItems', () => {
        describe('type-based sorting', () => {
            it('should sort multisig_import before multisig_sign', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const importItem = createMultisigImportItem(
                    new Date('2025-01-10T00:00:00Z'),
                )
                const signItem = createMultisigSignItem(
                    new Date('2025-01-20T00:00:00Z'),
                )

                const result = sortInboxItems(importItem, signItem, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should sort multisig_sign before asa_inbox', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const signItem = createMultisigSignItem(
                    new Date('2025-01-20T00:00:00Z'),
                )
                const asaItem = createASAInboxItem('ADDR1')

                const result = sortInboxItems(signItem, asaItem, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should sort multisig_import before asa_inbox', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const importItem = createMultisigImportItem(
                    new Date('2025-01-10T00:00:00Z'),
                )
                const asaItem = createASAInboxItem('ADDR1')

                const result = sortInboxItems(importItem, asaItem, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should sort asa_inbox after multisig_import', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const asaItem = createASAInboxItem('ADDR1')
                const importItem = createMultisigImportItem(
                    new Date('2025-01-10T00:00:00Z'),
                )

                const result = sortInboxItems(asaItem, importItem, accounts)

                expect(result).toBeGreaterThan(0)
            })
        })

        describe('date-based sorting within same type', () => {
            it('should sort newer multisig_import items first', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const newerItem = createMultisigImportItem(
                    new Date('2025-01-20T00:00:00Z'),
                    'msig-newer',
                )
                const olderItem = createMultisigImportItem(
                    new Date('2025-01-10T00:00:00Z'),
                    'msig-older',
                )

                const result = sortInboxItems(newerItem, olderItem, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should sort newer multisig_sign items first', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const newerItem = createMultisigSignItem(
                    new Date('2025-01-25T00:00:00Z'),
                    'sign-newer',
                )
                const olderItem = createMultisigSignItem(
                    new Date('2025-01-15T00:00:00Z'),
                    'sign-older',
                )

                const result = sortInboxItems(newerItem, olderItem, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should sort older items after newer items', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const olderItem = createMultisigImportItem(
                    new Date('2025-01-10T00:00:00Z'),
                )
                const newerItem = createMultisigImportItem(
                    new Date('2025-01-20T00:00:00Z'),
                )

                const result = sortInboxItems(olderItem, newerItem, accounts)

                expect(result).toBeGreaterThan(0)
            })

            it('should return 0 for items with identical createdAt', () => {
                const accounts = createMockAccounts(['ADDR1'])
                const sameDate = new Date('2025-01-15T00:00:00Z')
                const item1 = createMultisigImportItem(sameDate, 'msig-1')
                const item2 = createMultisigImportItem(sameDate, 'msig-2')

                const result = sortInboxItems(item1, item2, accounts)

                expect(result).toBe(0)
            })
        })

        describe('asa_inbox account-based sorting', () => {
            it('should sort asa_inbox items by account order in accounts array', () => {
                const accounts = createMockAccounts(['ADDR1', 'ADDR2', 'ADDR3'])
                const itemAddr2 = createASAInboxItem('ADDR2')
                const itemAddr1 = createASAInboxItem('ADDR1')

                const result = sortInboxItems(itemAddr2, itemAddr1, accounts)

                expect(result).toBeGreaterThan(0)
            })

            it('should sort asa_inbox for first account before second account', () => {
                const accounts = createMockAccounts(['ADDR1', 'ADDR2', 'ADDR3'])
                const itemAddr1 = createASAInboxItem('ADDR1')
                const itemAddr3 = createASAInboxItem('ADDR3')

                const result = sortInboxItems(itemAddr1, itemAddr3, accounts)

                expect(result).toBeLessThan(0)
            })

            it('should return 0 for asa_inbox items with same account', () => {
                const accounts = createMockAccounts(['ADDR1', 'ADDR2'])
                const item1 = createASAInboxItem('ADDR1')
                const item2 = createASAInboxItem('ADDR1')

                const result = sortInboxItems(item1, item2, accounts)

                expect(result).toBe(0)
            })

            it('should handle asa_inbox items with unknown addresses', () => {
                const accounts = createMockAccounts(['ADDR1', 'ADDR2'])
                const unknownItem = createASAInboxItem('UNKNOWN')
                const knownItem = createASAInboxItem('ADDR1')

                const result = sortInboxItems(unknownItem, knownItem, accounts)

                expect(result).toBeLessThan(0)
            })
        })

        describe('integration with Array.sort', () => {
            it('should correctly sort a mixed array of inbox items', () => {
                const accounts = createMockAccounts(['ADDR1', 'ADDR2', 'ADDR3'])
                const items: InboxItem[] = [
                    createASAInboxItem('ADDR2'),
                    createMultisigSignItem(
                        new Date('2025-01-15T00:00:00Z'),
                        'sign-older',
                    ),
                    createMultisigImportItem(
                        new Date('2025-01-10T00:00:00Z'),
                        'import-older',
                    ),
                    createASAInboxItem('ADDR1'),
                    createMultisigSignItem(
                        new Date('2025-01-25T00:00:00Z'),
                        'sign-newer',
                    ),
                    createMultisigImportItem(
                        new Date('2025-01-20T00:00:00Z'),
                        'import-newer',
                    ),
                ]

                const sorted = [...items].sort((a, b) =>
                    sortInboxItems(a, b, accounts),
                )

                expect(sorted[0].type).toBe('multisig_import')
                expect((sorted[0].data as MultiSigAccount).customId).toBe(
                    'import-newer',
                )

                expect(sorted[1].type).toBe('multisig_import')
                expect((sorted[1].data as MultiSigAccount).customId).toBe(
                    'import-older',
                )

                expect(sorted[2].type).toBe('multisig_sign')
                expect((sorted[2].data as MultisigSignRequest).id).toBe(
                    'sign-newer',
                )

                expect(sorted[3].type).toBe('multisig_sign')
                expect((sorted[3].data as MultisigSignRequest).id).toBe(
                    'sign-older',
                )

                expect(sorted[4].type).toBe('asa_inbox')
                expect((sorted[4].data as ASAInbox).address).toBe('ADDR1')

                expect(sorted[5].type).toBe('asa_inbox')
                expect((sorted[5].data as ASAInbox).address).toBe('ADDR2')
            })
        })
    })
})
