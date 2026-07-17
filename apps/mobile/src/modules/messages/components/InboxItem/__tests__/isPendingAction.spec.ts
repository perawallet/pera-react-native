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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { InboxItem } from '@perawallet/wallet-core-messages'
import { isPendingAction } from '../isPendingAction'

const multisigAccount = {
    customId: 'msig-1',
    createdAt: new Date('2025-01-10T00:00:00Z'),
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participantAddresses: ['ADDR1', 'ADDR2'],
}

describe('isPendingAction', () => {
    it('returns true for multisig_import', () => {
        const item: InboxItem = {
            type: 'multisig_import',
            data: {
                ...multisigAccount,
            },
            createdAt: new Date(0),
        }
        expect(isPendingAction(item)).toBe(true)
    })

    it.each(['pending', 'ready'] as const)(
        'returns true for multisig_sign with status %s',
        status => {
            const item: InboxItem = {
                type: 'multisig_sign',
                data: {
                    id: '1',
                    status,
                    type: 'transfer',
                    createdAt: new Date(0),
                    expectedExpireDatetime: new Date(0),
                    failReasonDisplay: null,
                    proposerAddress: null,
                    multisigAccount,
                    transactionLists: [],
                },
                createdAt: new Date(0),
            }
            expect(isPendingAction(item)).toBe(true)
        },
    )

    it('returns false for multisig_sign with status confirmed', () => {
        const item: InboxItem = {
            type: 'multisig_sign',
            data: {
                id: '1',
                status: 'confirmed',
                type: 'transfer',
                createdAt: new Date(0),
                expectedExpireDatetime: new Date(0),
                failReasonDisplay: null,
                proposerAddress: null,
                multisigAccount,
                transactionLists: [],
            },
            createdAt: new Date(0),
        }
        expect(isPendingAction(item)).toBe(false)
    })

    it('returns true for asa_inbox with requestCount > 0', () => {
        const item: InboxItem = {
            type: 'asa_inbox',
            data: {
                address: 'ADDR1',
                inboxAddress: null,
                requestCount: 2,
            },
            createdAt: new Date(0),
        }
        expect(isPendingAction(item)).toBe(true)
    })

    it('returns false for asa_inbox with requestCount 0', () => {
        const item: InboxItem = {
            type: 'asa_inbox',
            data: {
                address: 'ADDR1',
                inboxAddress: null,
                requestCount: 0,
            },
            createdAt: new Date(0),
        }
        expect(isPendingAction(item)).toBe(false)
    })
})
