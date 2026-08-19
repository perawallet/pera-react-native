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
import { SignedTransaction } from 'algosdk'
import {
    Address,
    assemblePQSignedTransaction,
    encodeAlgorandAddress,
    pqSigningDigest,
    type PeraSignedTransaction,
    type PeraTransaction,
    type PeraTransactionGroup,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
} from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../constants'

/**
 * How many transactions to encode + sign per chunk before yielding back to
 * the event loop. HD signing re-derives the child key and runs Ed25519 per
 * transaction synchronously, so signing a large batch (up to 1000) in one
 * burst starves the JS thread — the slide-to-confirm loading state never
 * paints and the whole UI freezes until it finishes (PERA-3353). Yielding
 * between chunks lets React commit the loading state and gives the UI thread
 * frames. Lower = smoother UI but more total overhead; tune as needed.
 */
export const SIGN_BATCH_SIZE = 16

export type UseLocalKeyTransactionSignerResult = {
    /**
     * Signs the transactions at `indexesToSign` with `account`'s key.
     *
     * The caller is responsible for resolving the correct account before
     * calling: for regular signing flows that means following rekey to the
     * auth account; for multisig cosign that means using the participant's
     * own (un-rekey-resolved) account. This hook signs with whatever account
     * it receives and does NOT follow rekey internally.
     *
     * Do NOT look the account up from `txn.sender`: for multisig cosign and
     * ARC-0001 explicit-`signers` flows, the signer differs from the
     * transaction sender, and lookup-by-sender would either pick the wrong
     * account or none at all.
     */
    signTransactions: (
        txnGroup: PeraTransaction[],
        indexesToSign: number[],
        account: WalletAccount,
    ) => Promise<PeraSignedTransaction[]>
}

export const useLocalKeyTransactionSigner =
    (): UseLocalKeyTransactionSignerResult => {
        const { signTransactionsWithKey, getPQSigningInfo } = useKMS()
        const { encodeTransaction } = useTransactionEncoder()

        // Algo25, HD wallet, and quantum accounts all reference their
        // signing key directly via `keyPairId`. `getPQSigningInfo` is the
        // single place that resolves the key's scheme — everything below
        // (batching, rekey `sgnr`, ordering) is shared regardless of which
        // branch it picks.
        const signSingleAccountTransactions = useCallback(
            async (
                account: WalletAccount,
                txns: PeraTransactionGroup,
            ): Promise<PeraSignedTransaction[]> => {
                if (
                    !isAlgo25Account(account) &&
                    !isHDWalletAccount(account) &&
                    !isQuantumAccount(account)
                ) {
                    return Promise.reject(
                        `Unsupported account type ${account.type} for ${account.address}`,
                    )
                }

                // The only scheme-dependent decision in this hook: what bytes
                // to sign, and which field to put the signature in. Everything
                // else — batching, rekey `sgnr`, ordering — is shared. This is
                // the same altitude as the algo25-vs-HD difference, which the
                // keystore resolves internally by child type.
                const pqInfo = getPQSigningInfo(account.keyPairId)

                const signed: PeraSignedTransaction[] = []

                for (
                    let start = 0;
                    start < txns.length;
                    start += SIGN_BATCH_SIZE
                ) {
                    // Yield between chunks so the UI thread gets a frame and
                    // React can paint the signing state. Skipped before the
                    // first chunk so small/single signs keep their snappy,
                    // single-tick path.
                    if (start > 0) {
                        await deferToNextCycle()
                    }

                    const batch = txns.slice(start, start + SIGN_BATCH_SIZE)
                    const payloads = pqInfo
                        ? batch.map(txn => pqSigningDigest(txn))
                        : batch.map(txn => encodeTransaction(txn))
                    const signatures = await signTransactionsWithKey(
                        account.keyPairId,
                        SIGNING_KEY_DOMAIN,
                        payloads,
                    )

                    batch.forEach((txn, idx) => {
                        if (pqInfo) {
                            signed.push(
                                assemblePQSignedTransaction({
                                    txn,
                                    signature: {
                                        schemeId: pqInfo.schemeId,
                                        publicKey: pqInfo.publicKey,
                                        signature: signatures[idx],
                                    },
                                }),
                            )
                            return
                        }

                        const senderPublicKey = encodeAlgorandAddress(
                            txn.sender.publicKey,
                        )
                        signed.push(
                            new SignedTransaction({
                                txn,
                                sig: signatures[idx],
                                sgnr:
                                    account.address !== senderPublicKey
                                        ? Address.fromString(account.address)
                                        : undefined,
                            }),
                        )
                    })
                }

                return signed
            },
            [signTransactionsWithKey, getPQSigningInfo, encodeTransaction],
        )

        const signTransactions = useCallback(
            async (
                txnGroup: PeraTransaction[],
                indexesToSign: number[],
                account: WalletAccount,
            ): Promise<PeraSignedTransaction[]> => {
                const result = txnGroup.map(
                    txn => new SignedTransaction({ txn }),
                )

                const toSign = indexesToSign.map(i => txnGroup[i])
                const signedTxns = await signSingleAccountTransactions(
                    account,
                    toSign,
                )
                signedTxns.forEach((signedTxn, idx) => {
                    result[indexesToSign[idx]] = signedTxn
                })
                return result
            },
            [signSingleAccountTransactions],
        )

        return {
            signTransactions,
        }
    }
