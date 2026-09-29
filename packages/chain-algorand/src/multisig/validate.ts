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

import { decodeTransaction } from '@perawallet/wallet-core-blockchain'
import type {
    MultisigSignRequest,
    MultisigSignRequestValidation,
} from '@perawallet/wallet-core-multisig'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { generateMultisigAddress } from './address'

const senderOf = (rawTransactionBase64: string): string | null => {
    try {
        return decodeTransaction(
            decodeFromBase64(rawTransactionBase64),
        ).sender.toString()
    } catch {
        return null
    }
}

/**
 * A cosignature is only ever a subsig of the joint account, so two checks
 * close the standalone-single-sig drain. The derive check pins the joint
 * address to a genuine msig hash, so a fabricated request can't pass off a
 * participant's personal address as the joint account (which would make the
 * sender check vacuous). The sender check is an allowlist because the
 * signature covers `"TX" || txn` only: it stands alone for any sender whose
 * auth-addr is the signer's key.
 */
export const validateAlgorandSignRequest = (
    request: MultisigSignRequest,
    authorizedSenders: ReadonlySet<string>,
): MultisigSignRequestValidation => {
    const { address, version, threshold, participantAddresses } =
        request.multisigAccount
    const transactionList = request.transactionLists[0]
    if (!transactionList) {
        return { kind: 'no-transactions' }
    }

    if (
        generateMultisigAddress(version, threshold, participantAddresses) !==
        address
    ) {
        return { kind: 'address-mismatch' }
    }

    const txIndex = transactionList.rawTransactions.findIndex(raw => {
        const sender = senderOf(raw)
        return sender === null || !authorizedSenders.has(sender)
    })
    return txIndex === -1
        ? { kind: 'valid' }
        : { kind: 'unauthorized-sender', txIndex }
}
