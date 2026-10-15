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

import { Decimal } from 'decimal.js'
import type {
    ChainScope,
    ChainTransactionData,
    PeraSignedTransaction,
    PeraTransaction,
    SignedTransaction,
    TransactionSummary,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64, type Nullable } from '@perawallet/wallet-core-shared'
import {
    TransportError,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import {
    decodeSignedTransaction,
    decodeTransaction,
    encodeSignedTransaction,
} from '../blockchain/utils/transact'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../descriptor'
import {
    APP_CALL_TITLE_KEY,
    ASSET_CONFIG_TITLE_KEY,
    ASSET_FREEZE_TITLE_KEY,
    DEFAULT_TITLE_KEY,
    KEY_REGISTRATION_TITLE_KEY,
    OPT_IN_TITLE_KEY,
    OPT_OUT_TITLE_KEY,
    SEND_TITLE_KEY,
    assetRefOf,
} from '../transactions/summarize'

const chainSpecific = (
    titleKey: string,
    icon: TransactionSummary['icon'],
): TransactionSummary => ({
    kind: 'chain-specific',
    title: { key: titleKey },
    direction: 'none',
    icon,
})

const transferSummary = (
    transaction: PeraTransaction,
    receiver: string,
    assetId: string,
    amount: bigint,
): TransactionSummary => {
    const isSelf = receiver === transaction.sender.toString()
    return {
        kind: isAlgorandNativeAssetId(assetId) ? 'transfer' : 'token-transfer',
        title: { key: SEND_TITLE_KEY },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: receiver,
        amount: { assetRef: assetRefOf(assetId), value: new Decimal(amount.toString()) },
    }
}

export const summarizeAlgorandTransaction = (
    transaction: PeraTransaction,
): TransactionSummary => {
    const { payment, assetTransfer } = transaction
    switch (transaction.type) {
        case 'pay':
            return payment
                ? transferSummary(
                      transaction,
                      payment.receiver.toString(),
                      algorandDescriptor.nativeAsset.ref.assetId,
                      payment.amount,
                  )
                : chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
        case 'axfer': {
            if (!assetTransfer) return chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
            const receiver = assetTransfer.receiver.toString()
            if (assetTransfer.closeRemainderTo) {
                return chainSpecific(OPT_OUT_TITLE_KEY, 'opt-out')
            }
            if (
                assetTransfer.amount === 0n &&
                receiver === transaction.sender.toString()
            ) {
                return chainSpecific(OPT_IN_TITLE_KEY, 'opt-in')
            }
            return transferSummary(
                transaction,
                receiver,
                assetTransfer.assetIndex.toString(),
                assetTransfer.amount,
            )
        }
        case 'appl':
            return {
                kind: 'contract-call',
                title: { key: APP_CALL_TITLE_KEY },
                direction: 'none',
                icon: 'contract-call',
            }
        case 'keyreg':
            return chainSpecific(KEY_REGISTRATION_TITLE_KEY, 'consensus')
        case 'acfg':
            return chainSpecific(ASSET_CONFIG_TITLE_KEY, 'asset-config')
        case 'afrz':
            return chainSpecific(ASSET_FREEZE_TITLE_KEY, 'asset-freeze')
        default:
            return chainSpecific(DEFAULT_TITLE_KEY, 'unknown')
    }
}

const chainDataOf = (transaction: PeraTransaction): ChainTransactionData => {
    const closeRemainderTo =
        transaction.payment?.closeRemainderTo ??
        transaction.assetTransfer?.closeRemainderTo
    return {
        family: 'algorand',
        ...(transaction.group && { groupId: encodeToBase64(transaction.group) }),
        ...(transaction.rekeyTo && { rekeyTo: transaction.rekeyTo.toString() }),
        ...(closeRemainderTo && {
            closeRemainderTo: closeRemainderTo.toString(),
        }),
    }
}

export const toUnsignedAlgorandTransaction = (
    transaction: PeraTransaction,
    scope: ChainScope,
): UnsignedTransaction => {
    // `AlgorandTransactionPayload`'s shape; `readAlgorandTransaction` reads it.
    const payload: { transaction: PeraTransaction } = { transaction }
    return {
        scope,
        payload,
        summary: summarizeAlgorandTransaction(transaction),
        chainData: chainDataOf(transaction),
    }
}

export const toUnsignedAlgorandTransactions = (
    transactions: PeraTransaction[],
    scope: ChainScope,
): UnsignedTransaction[] =>
    transactions.map(transaction =>
        toUnsignedAlgorandTransaction(transaction, scope),
    )

// Only chain-algorand builds these payloads, so the record is the one
// `toUnsignedAlgorandTransaction` wrote; `readAlgorandTransaction` stays the
// check for payloads from anywhere else.
const payloadOf = (
    unsigned: UnsignedTransaction,
): { transaction: PeraTransaction } =>
    unsigned.payload as { transaction: PeraTransaction }

/** The transaction of a payload chain-algorand built itself, with no network check. */
export const algorandTransactionOf = (
    unsigned: UnsignedTransaction,
): PeraTransaction => payloadOf(unsigned).transaction

export const withAlgorandTransaction = (
    unsigned: UnsignedTransaction,
    transaction: PeraTransaction,
): UnsignedTransaction => {
    const payload = payloadOf(unsigned)
    if (payload.transaction === transaction) return unsigned
    return {
        scope: unsigned.scope,
        payload: { ...payload, transaction },
        summary: summarizeAlgorandTransaction(transaction),
        chainData: chainDataOf(transaction),
    }
}

export const decodeUnsignedAlgorandTransaction = (
    bytes: Uint8Array,
    scope: ChainScope,
): UnsignedTransaction =>
    toUnsignedAlgorandTransaction(decodeTransaction(bytes), scope)

export const toSignedAlgorandTransaction = (
    signed: PeraSignedTransaction,
    scope: ChainScope,
): SignedTransaction => ({
    scope,
    id: signed.txn.txID(),
    bytes: encodeSignedTransaction(signed),
})

// The bytes are kept as given: a signature another party made must reach the
// node exactly as they encoded it.
export const signedAlgorandTransactionFromBytes = (
    bytes: Uint8Array,
    scope: ChainScope,
): SignedTransaction => ({
    scope,
    id: decodeSignedTransaction(bytes).txn.txID(),
    bytes,
})

export const algorandSignedTransactionsOf = (
    result: SigningResult,
    scope: ChainScope,
): Nullable<SignedTransaction>[] => {
    const { signedData } = result
    if (signedData.type === 'signed-transactions') {
        return Array.from(signedData.signed, signed => signed ?? null)
    }
    if (signedData.type === 'transactions') {
        return Array.from(signedData.signed, signed =>
            signed ? toSignedAlgorandTransaction(signed, scope) : null,
        )
    }
    throw new TransportError(
        `A ${signedData.type} result carries no signed transactions`,
    )
}
