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

import {
    i18nKey,
    type TransactionNotice,
} from '@perawallet/wallet-core-chain-contract'
import type { TransactionHistoryStatus } from '../models/types'

const PENDING = i18nKey('transactions.notice.pending')
const FAILED = i18nKey('transactions.notice.failed')
const REPLACED = i18nKey('transactions.notice.replaced')
const REPLACEMENT_NOT_NEEDED = i18nKey(
    'transactions.notice.replacement_not_needed',
)

/**
 * The notice a summary carries for a non-final status; undefined for a
 * confirmed (or unknown, which reads as confirmed) one.
 *
 * @param since Unix ms the transaction was first seen; shown on a pending notice only.
 */
export const transactionStatusNotice = (
    status: TransactionHistoryStatus | undefined,
    since?: number,
): TransactionNotice | undefined => {
    if (status === 'pending') {
        return {
            kind: 'warning',
            title: { key: PENDING },
            ...(since !== undefined && { since }),
        }
    }
    if (status === 'failed') return { kind: 'error', title: { key: FAILED } }
    if (status === 'replaced') {
        return { kind: 'warning', title: { key: REPLACED } }
    }
    return undefined
}

/** A replacement that never landed because the transaction it re-priced confirmed first. */
export const replacementNotNeededNotice = (): TransactionNotice => ({
    kind: 'warning',
    title: { key: REPLACEMENT_NOT_NEEDED },
})
