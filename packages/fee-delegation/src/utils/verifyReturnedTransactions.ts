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

import {
    rawTransactionsMatch,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

export type VerifyReturnedTransactionsParams = {
    /** The unsigned transactions the wallet sent to the backend. */
    sent: PeraTransaction[]
    /**
     * The to-sign slots the backend returned. Their group field is legitimately
     * re-assigned by the backend's re-group, so it is excluded from the match.
     */
    returnedToSign: PeraTransaction[]
    /** The account that owns — and must be the sender of — every wallet slot. */
    account: string
    /** Canonical msgpack encoder for a transaction. */
    encodeTransaction: (txn: PeraTransaction) => Uint8Array
}

/**
 * Encode a transaction to base64 with its group field cleared, restoring the
 * original group afterwards. The backend re-groups the submitted transactions
 * (so the group id legitimately changes); everything else must be identical, so
 * the group is the one field excluded from the byte comparison.
 */
const encodeWithoutGroup = (
    txn: PeraTransaction,
    encodeTransaction: (txn: PeraTransaction) => Uint8Array,
): string => {
    const savedGroup = txn.group
    txn.group = undefined
    try {
        return encodeToBase64(encodeTransaction(txn))
    } finally {
        txn.group = savedGroup
    }
}

/**
 * Trust-anchor check for fee delegation. Before the wallet signs anything, pin
 * that every to-sign slot the backend returned is byte-identical — modulo the
 * re-assigned group field — to a transaction the wallet actually sent, in the
 * same order, and is sent by the requesting account.
 *
 * Without this, a malicious/compromised backend (or a TLS MITM) could swap an
 * attacker-favorable transaction (drain payment, ASA transfer, rekey to an
 * attacker key) into the wallet's slot and have it signed headlessly. Mirrors
 * the multisig handoff trust-anchor (`rawTransactionsMatch`).
 */
export const returnedTransactionsMatchSent = ({
    sent,
    returnedToSign,
    account,
    encodeTransaction,
}: VerifyReturnedTransactionsParams): boolean => {
    const everySenderIsAccount = returnedToSign.every(
        txn => txn.sender.toString() === account,
    )
    if (!everySenderIsAccount) {
        return false
    }

    return rawTransactionsMatch(
        sent.map(txn => encodeWithoutGroup(txn, encodeTransaction)),
        returnedToSign.map(txn => encodeWithoutGroup(txn, encodeTransaction)),
    )
}
