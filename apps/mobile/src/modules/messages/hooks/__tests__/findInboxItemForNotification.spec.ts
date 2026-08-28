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
import type { InboxItem } from '@perawallet/wallet-core-messages'
import { findInboxItemForNotification } from '../useHandleMultisigNotification'

const importItem = (address: string): InboxItem =>
    ({
        type: 'multisig_import',
        data: { address },
        createdAt: new Date(0),
    }) as InboxItem

const signItem = (address: string): InboxItem =>
    ({
        type: 'multisig_sign',
        data: { multisigAccount: { address } },
        createdAt: new Date(0),
    }) as InboxItem

const asaItem = (): InboxItem =>
    ({
        type: 'asa_inbox',
        data: { address: 'ASA', inboxAddress: null, requestCount: 1 },
        createdAt: new Date(0),
    }) as InboxItem

describe('findInboxItemForNotification', () => {
    describe('with an address (in-app notification)', () => {
        it('returns the item whose account matches', () => {
            const target = importItem('B')

            const match = findInboxItemForNotification(
                [importItem('A'), target],
                'import',
                'B',
            )

            expect(match).toBe(target)
        })

        it('returns nothing when no account matches', () => {
            const match = findInboxItemForNotification(
                [importItem('A')],
                'import',
                'B',
            )

            expect(match).toBeUndefined()
        })

        it('does not cross kinds', () => {
            const match = findInboxItemForNotification(
                [signItem('A')],
                'import',
                'A',
            )

            expect(match).toBeUndefined()
        })
    })

    // A push carries no address, so the kind alone targets the item.
    describe('without an address (push notification)', () => {
        it('returns the only pending item of that kind', () => {
            const target = importItem('A')

            const match = findInboxItemForNotification(
                [target, asaItem(), signItem('B')],
                'import',
                undefined,
            )

            expect(match).toBe(target)
        })

        it('returns nothing when several of that kind are pending', () => {
            const match = findInboxItemForNotification(
                [importItem('A'), importItem('B')],
                'import',
                undefined,
            )

            expect(match).toBeUndefined()
        })

        it('returns nothing when none of that kind are pending', () => {
            const match = findInboxItemForNotification(
                [asaItem()],
                'import',
                null,
            )

            expect(match).toBeUndefined()
        })
    })
})
