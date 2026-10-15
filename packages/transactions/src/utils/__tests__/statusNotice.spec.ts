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

import { describe, expect, it } from 'vitest'
import {
    TRANSACTION_STATUS_NOTICE_KEYS,
    transactionStatusNotice,
} from '../statusNotice'

const SINCE = 1752576000000

describe('transactionStatusNotice', () => {
    it('warns about a pending transaction since when it was first seen', () => {
        expect(transactionStatusNotice('pending', SINCE)).toEqual({
            kind: 'warning',
            title: { key: 'transactions.notice.pending' },
            since: SINCE,
        })
    })

    it('omits since on a pending transaction with no known time', () => {
        expect(transactionStatusNotice('pending')).not.toHaveProperty('since')
    })

    it('flags a failed transaction as an error, without a time', () => {
        expect(transactionStatusNotice('failed', SINCE)).toEqual({
            kind: 'error',
            title: { key: 'transactions.notice.failed' },
        })
    })

    it('warns about a replaced transaction', () => {
        expect(transactionStatusNotice('replaced', SINCE)).toEqual({
            kind: 'warning',
            title: { key: 'transactions.notice.replaced' },
        })
    })

    it.each([['confirmed' as const], [undefined]])(
        'has no notice for %s',
        status => {
            expect(transactionStatusNotice(status, SINCE)).toBeUndefined()
        },
    )

    it('lists every key it emits', () => {
        const emitted = (['pending', 'failed', 'replaced'] as const).map(
            status => transactionStatusNotice(status)?.title.key,
        )
        expect(emitted).toEqual([...TRANSACTION_STATUS_NOTICE_KEYS])
    })
})
