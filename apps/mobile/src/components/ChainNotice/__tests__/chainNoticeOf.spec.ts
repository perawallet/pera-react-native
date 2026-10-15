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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { chainNoticeOf } from '../chainNoticeOf'

const SINCE = 1_700_000_000_000

describe('chainNoticeOf', () => {
    it('is null without a notice', () => {
        expect(chainNoticeOf(undefined)).toBeNull()
    })

    it('formats since into the since param', () => {
        expect(
            chainNoticeOf({
                kind: 'warning',
                title: { key: i18nKey('transactions.notice.pending') },
                since: SINCE,
            }),
        ).toEqual({
            kind: 'warning',
            titleKey: 'transactions.notice.pending',
            params: {
                since: formatDatetime(new Date(SINCE), undefined, 'short'),
            },
        })
    })

    it('keeps the title params alongside since', () => {
        const notice = chainNoticeOf({
            kind: 'warning',
            title: {
                key: i18nKey('transactions.notice.pending'),
                params: { chain: 'Ethereum' },
            },
            since: SINCE,
        })

        expect(notice?.params).toMatchObject({ chain: 'Ethereum' })
        expect(notice?.params?.since).toBeTruthy()
    })

    it('passes a notice without since through unchanged', () => {
        expect(
            chainNoticeOf({
                kind: 'error',
                title: { key: i18nKey('transactions.notice.failed') },
            }),
        ).toEqual({ kind: 'error', titleKey: 'transactions.notice.failed' })
    })
})
