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

import { OnApplicationComplete, type Transaction } from 'algosdk'

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
 * not care about it — except the fields listed in {@link DESTRUCTIVE_DEFAULTS},
 * where silence means "must not be present".
 *
 * All amounts are base units (microAlgos for `pay`, asset base units for
 * `axfer`), never display units.
 */
export type TxnIntent = {
    type: TxnIntentType
    sender: string
    /**
     * Required. The fee the caller expects the chain to charge, read off the
     * built transaction before submitting. Leaving it optional let a suite drop
     * fee conformance silently: the balance delta is derived from the confirmed
     * fee, so the two agree by construction and catch nothing.
     */
    fee: bigint
    receiver?: string
    amount?: bigint
    assetId?: bigint
    closeRemainderTo?: string
    assetCloseTo?: string
    /** `axfer` clawback source — the account the units are seized from. */
    assetSender?: string
    rekeyTo?: string
    /** `afrz` target account. */
    freezeAccount?: string
    /** `afrz` direction. */
    frozen?: boolean
    appIndex?: bigint
    onComplete?: OnApplicationComplete
    /** `keyreg` — marks the account permanently non-participating. */
    nonParticipation?: boolean
    /** `acfg` roles. Omitting one asserts the transaction does not set it. */
    manager?: string
    reserve?: string
    freeze?: string
    clawback?: string
    note?: Uint8Array
    lease?: Uint8Array
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

/** `NoOp`/`DeleteApplication` rather than `0`/`5`, so the diff is readable. */
const onCompleteName = (value?: OnApplicationComplete): string | undefined =>
    value === undefined
        ? undefined
        : (OnApplicationComplete[value] ?? `${value}`)

const READERS: Record<string, (txn: Transaction) => unknown> = {
    type: txn => String(txn.type),
    sender: txn => txn.sender.toString(),
    fee: txn => txn.fee,
    receiver: txn =>
        address(txn.payment?.receiver ?? txn.assetTransfer?.receiver),
    amount: txn => txn.payment?.amount ?? txn.assetTransfer?.amount,
    assetId: txn =>
        txn.assetTransfer?.assetIndex ??
        txn.assetConfig?.assetIndex ??
        txn.assetFreeze?.assetIndex,
    closeRemainderTo: txn => address(txn.payment?.closeRemainderTo),
    assetCloseTo: txn => address(txn.assetTransfer?.closeRemainderTo),
    assetSender: txn => address(txn.assetTransfer?.assetSender),
    rekeyTo: txn => address(txn.rekeyTo),
    freezeAccount: txn => address(txn.assetFreeze?.freezeAccount),
    frozen: txn => txn.assetFreeze?.frozen,
    appIndex: txn => txn.applicationCall?.appIndex,
    onComplete: txn => onCompleteName(txn.applicationCall?.onComplete),
    nonParticipation: txn => txn.keyreg?.nonParticipation ?? false,
    manager: txn => address(txn.assetConfig?.manager),
    reserve: txn => address(txn.assetConfig?.reserve),
    freeze: txn => address(txn.assetConfig?.freeze),
    clawback: txn => address(txn.assetConfig?.clawback),
    note: txn => bytes(txn.note),
    lease: txn => bytes(txn.lease),
    isGrouped: txn => bytes(txn.group) !== undefined,
}

/** Declared values that need the same shaping their reader applies. */
const NORMALIZERS: Record<string, (value: unknown) => unknown> = {
    onComplete: value => onCompleteName(value as OnApplicationComplete),
}

const readField = (field: string, txn: Transaction): unknown => {
    const reader = READERS[field]
    if (!reader) {
        throw new Error(`no transaction projection for intent field "${field}"`)
    }
    return reader(txn)
}

/**
 * Fields whose absence from an intent asserts their absence from the chain,
 * with the value that absence means.
 *
 * Silence about these cannot be read as "don't care". Each one hands something
 * away irreversibly, and each produces a transaction a real node accepts and
 * confirms: a payment that also rekeys the sender, an `axfer` whose
 * `assetSender` seizes a third party's units under clawback authority, an
 * `acfg` that reassigns the manager or clawback role, a `keyreg` that marks the
 * account permanently non-participating.
 */
const DESTRUCTIVE_DEFAULTS: Record<string, unknown> = {
    rekeyTo: undefined,
    closeRemainderTo: undefined,
    assetCloseTo: undefined,
    assetSender: undefined,
    manager: undefined,
    reserve: undefined,
    freeze: undefined,
    clawback: undefined,
    nonParticipation: false,
}

/**
 * The payload fields each operation is meaningless without. Without this,
 * `{ type: 'pay', sender, fee }` is a valid intent that any payment of any
 * amount to any receiver satisfies — a green test proving nothing, with no
 * signal that it proved nothing.
 */
const REQUIRED_FIELDS: Record<TxnIntentType, readonly string[]> = {
    pay: ['receiver', 'amount'],
    axfer: ['assetId', 'receiver', 'amount'],
    acfg: ['assetId'],
    afrz: ['assetId', 'freezeAccount', 'frozen'],
    appl: ['appIndex', 'onComplete'],
    keyreg: [],
}

export const assertIntentComplete = (intent: TxnIntent): void => {
    const required = ['sender', 'fee', ...REQUIRED_FIELDS[intent.type]]
    const missing = required.filter(
        field => intent[field as keyof TxnIntent] === undefined,
    )
    if (missing.length > 0) {
        throw new Error(
            `incomplete ${intent.type} intent: declare ${missing.join(', ')}. An intent that omits these is satisfied by transactions it never described.`,
        )
    }
}

/**
 * Projects `intent` and `txn` onto the same key set — the fields the intent
 * declares, plus {@link DESTRUCTIVE_DEFAULTS}, and nothing else — so
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
        expected[field] = NORMALIZERS[field]?.(value) ?? value
    }

    for (const [field, absent] of Object.entries(DESTRUCTIVE_DEFAULTS)) {
        if (!(field in expected)) expected[field] = absent
    }

    const actual = Object.fromEntries(
        Object.keys(expected).map(field => [field, readField(field, txn)]),
    )

    return { expected, actual }
}
