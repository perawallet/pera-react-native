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

import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

/** Aggregate details for a DEX swap, whose transactions are grouped. */
export interface AlgorandSwapGroupDetail {
    /** Decimal string — uint64 ids must never live in a JS number. */
    assetInId: Nullable<string>
    assetInUnitName: string
    /** 0-19. */
    assetInDecimals: number
    /** Decimal string. */
    assetOutId: Nullable<string>
    assetOutUnitName: string
    /** 0-19. */
    assetOutDecimals: number
    /** Base units. */
    amountIn: Decimal
    /** Base units. */
    amountOut: Decimal
}

/** The Algorand facts a history row carries in `TransactionHistoryItem.chainData`. */
export interface AlgorandHistoryData {
    family: 'algorand'
    /** Base64. Set for atomic groups. */
    groupId: Nullable<string>
    closeTo: Nullable<string>
    /**
     * Base units swept to `closeTo` when the sender closed the account (pay)
     * or holding (axfer). Separate from `amount` — a close-out sends its whole
     * balance here with `amount` 0.
     */
    closeAmount: Nullable<Decimal>
    /** Decimal string: a uint64 id never lives in a JS number. */
    applicationId: Nullable<string>
    innerTransactionCount: Nullable<number>
    /** Only present for DEX swaps. */
    swapGroupDetail: Nullable<AlgorandSwapGroupDetail>
}

export const EMPTY_ALGORAND_HISTORY_DATA: Readonly<AlgorandHistoryData> =
    Object.freeze({
        family: 'algorand',
        groupId: null,
        closeTo: null,
        closeAmount: null,
        applicationId: null,
        innerTransactionCount: null,
        swapGroupDetail: null,
    })

const isAlgorandHistoryData = (value: unknown): value is AlgorandHistoryData =>
    typeof value === 'object' &&
    value !== null &&
    (value as { family?: unknown }).family === 'algorand'

/** Never throws: a pending row, or one from another family, reads as all-null. */
export const algorandHistoryDataOf = (
    item: Pick<TransactionHistoryItem, 'chainData'>,
): AlgorandHistoryData =>
    isAlgorandHistoryData(item.chainData)
        ? item.chainData
        : EMPTY_ALGORAND_HISTORY_DATA

/** Only a swap's rows open their group's list; any other grouped row opens its own detail. */
export const algorandGroupToOpen = (
    item: TransactionHistoryItem,
): Nullable<string> => {
    const { swapGroupDetail, groupId } = algorandHistoryDataOf(item)
    return swapGroupDetail && groupId ? groupId : null
}
