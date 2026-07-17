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

import { useKMS } from '@perawallet/wallet-core-kms'
import { useCallback } from 'react'
import {
    assembleQuantumSignedTxn,
    useTransactionEncoder,
    type QuantumSignedTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import type { QuantumSigningFunction } from '../pipeline/signing/createQuantumStrategy'
import { SIGNING_KEY_DOMAIN } from '../constants'

/**
 * How many transactions to encode + sign per chunk before yielding back to
 * the event loop. Mirrors `SIGN_BATCH_SIZE` in `useLocalKeyTransactionSigner`
 * (PERA-3353): signing a large batch in one burst starves the JS thread, so
 * chunking lets React commit the loading state between chunks. Kept as its
 * own constant (rather than importing the local-key hook's) so the quantum
 * signer has no import-time coupling to it.
 */
export const QUANTUM_SIGN_BATCH_SIZE = 16

export type UseQuantumTransactionSignerResult = {
    /**
     * Signs the transactions at `indexesToSign` with `account`'s quantum
     * (Falcon-1024) key, returning the pqsig byte carrier for each signed
     * transaction — one entry per signed index, in the same order as
     * `indexesToSign` (unlike `useLocalKeyTransactionSigner`, there is no
     * "unsigned placeholder" shape for `QuantumSignedTransaction`, so the
     * result is not padded out to `txnGroup.length`).
     *
     * As with the local-key signer, the caller resolves the correct account
     * (rekey / cosign routing) before calling — this hook signs with
     * whatever account it receives.
     */
    signQuantumTransactions: QuantumSigningFunction
}

export const useQuantumTransactionSigner =
    (): UseQuantumTransactionSignerResult => {
        const { signTransactionsWithKey, getQuantumPublicKey } = useKMS()
        const { encodeTransaction, encodeTransactionRaw } =
            useTransactionEncoder()

        const signQuantumTransactions = useCallback<QuantumSigningFunction>(
            async (txnGroup, indexesToSign, account: WalletAccount) => {
                if (!account.keyPairId) {
                    throw new Error(
                        `Quantum signing requires a keyPairId for ${account.address ?? account.id}`,
                    )
                }
                const keyPairId = account.keyPairId
                // Invariant for the whole call — hoisted out of the
                // per-transaction loop below rather than re-read per txn.
                const publicKey = getQuantumPublicKey(keyPairId)

                const toSign = indexesToSign.map(i => txnGroup[i])
                const signed: QuantumSignedTransaction[] = []

                for (
                    let start = 0;
                    start < toSign.length;
                    start += QUANTUM_SIGN_BATCH_SIZE
                ) {
                    // Yield between chunks so the UI thread gets a frame
                    // between bursts of Falcon signing (see
                    // `useLocalKeyTransactionSigner` for the same pattern).
                    if (start > 0) {
                        await deferToNextCycle()
                    }

                    const batch = toSign.slice(
                        start,
                        start + QUANTUM_SIGN_BATCH_SIZE,
                    )
                    const encoded = batch.map(txn => encodeTransaction(txn))
                    const falconSignatures = await signTransactionsWithKey(
                        keyPairId,
                        SIGNING_KEY_DOMAIN,
                        encoded,
                    )

                    for (let idx = 0; idx < batch.length; idx++) {
                        const txn = batch[idx]
                        const pqSignedBytes = await assembleQuantumSignedTxn({
                            unsignedTxnBytes: encodeTransactionRaw(txn),
                            publicKey,
                            falconSignature: falconSignatures[idx],
                        })
                        signed.push({ txn, pqSignedBytes })
                    }
                }

                return signed
            },
            [
                signTransactionsWithKey,
                getQuantumPublicKey,
                encodeTransaction,
                encodeTransactionRaw,
            ],
        )

        return { signQuantumTransactions }
    }
