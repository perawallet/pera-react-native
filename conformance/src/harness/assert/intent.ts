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

import type { Transaction } from 'algosdk'

export type TxnIntentType =
    | 'pay'
    | 'axfer'
    | 'appl'
    | 'keyreg'
    | 'acfg'
    | 'afrz'

/**
 * What a suite says a transaction is supposed to be. Every declared field is
 * asserted against both the submitted bytes and the confirmed transaction;
 * every omitted field is not asserted at all, because a caller may legitimately
 * not care about it.
 *
 * All amounts are base units (microAlgos for `pay`, asset base units for
 * `axfer`), never display units.
 */
export type TxnIntent = {
    type: TxnIntentType
    sender: string
    receiver?: string
    amount?: bigint
    assetId?: bigint
    closeRemainderTo?: string
    assetCloseTo?: string
    rekeyTo?: string
    note?: Uint8Array
    lease?: Uint8Array
    fee?: bigint
    /** 1 asserts the transaction carries no group id; >1 asserts it carries one. */
    groupSize?: number
}

/** The comparable projections of an intent and a decoded transaction. */
export type IntentComparison = {
    expected: Record<string, unknown>
    actual: Record<string, unknown>
}

const address = (value?: { toString: () => string }): string | undefined =>
    value?.toString()

// algosdk materializes an absent note/lease as a zero-length array; collapsing
// it to `undefined` is what makes "the intent declared a note the chain does not
// carry" print as `(unset)` rather than as an empty hex string.
const bytes = (value?: Uint8Array): Uint8Array | undefined =>
    value && value.length > 0 ? value : undefined

const READERS: Record<string, (txn: Transaction) => unknown> = {
    type: txn => String(txn.type),
    sender: txn => txn.sender.toString(),
    receiver: txn =>
        address(txn.payment?.receiver ?? txn.assetTransfer?.receiver),
    amount: txn => txn.payment?.amount ?? txn.assetTransfer?.amount,
    assetId: txn =>
        txn.assetTransfer?.assetIndex ??
        txn.assetConfig?.assetIndex ??
        txn.assetFreeze?.assetIndex,
    closeRemainderTo: txn => address(txn.payment?.closeRemainderTo),
    assetCloseTo: txn => address(txn.assetTransfer?.closeRemainderTo),
    rekeyTo: txn => address(txn.rekeyTo),
    note: txn => bytes(txn.note),
    lease: txn => bytes(txn.lease),
    fee: txn => txn.fee,
    isGrouped: txn => bytes(txn.group) !== undefined,
}

const readField = (field: string, txn: Transaction): unknown => {
    const reader = READERS[field]
    if (!reader) {
        throw new Error(`no transaction projection for intent field "${field}"`)
    }
    return reader(txn)
}

/**
 * The fields that hand an account away. Unlike `note` or `lease`, silence about
 * these cannot mean "don't care": a payment that also rekeys the sender is
 * accepted and confirmed by a real node, and would otherwise conform to any
 * intent that simply never mentioned `rekeyTo`. Omitting one asserts it absent.
 */
const DESTRUCTIVE_FIELDS = [
    'rekeyTo',
    'closeRemainderTo',
    'assetCloseTo',
] as const

/**
 * Projects `intent` and `txn` onto the same key set — the fields the intent
 * declares, plus {@link DESTRUCTIVE_FIELDS}, and nothing else — so
 * {@link formatFieldDiff} can compare them.
 */
export const compareIntent = (
    intent: TxnIntent,
    txn: Transaction,
): IntentComparison => {
    const expected: Record<string, unknown> = {}

    for (const [field, value] of Object.entries(intent)) {
        if (value === undefined) continue
        // A group id is a property of the group, not a field of the intent, so
        // `groupSize` is asserted as the presence of one on this transaction.
        if (field === 'groupSize') {
            expected.isGrouped = (value as number) > 1
            continue
        }
        expected[field] = value
    }

    for (const field of DESTRUCTIVE_FIELDS) {
        if (!(field in expected)) expected[field] = undefined
    }

    const actual = Object.fromEntries(
        Object.keys(expected).map(field => [field, readField(field, txn)]),
    )

    return { expected, actual }
}
