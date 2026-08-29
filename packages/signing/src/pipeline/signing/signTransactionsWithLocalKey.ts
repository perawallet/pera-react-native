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

import { SignedTransaction } from 'algosdk'
import {
    Address,
    assemblePQSignedTransaction,
    encodeAlgorandAddress,
    pqSigningDigest,
    type PeraSignedTransaction,
    type PeraTransaction,
    type PeraTransactionGroup,
    type PQSchemeId,
} from '@perawallet/wallet-core-blockchain'
import {
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'

/**
 * How many transactions to encode + sign per chunk before yielding back to
 * the event loop. HD signing re-derives the child key and runs Ed25519 per
 * transaction synchronously, so signing a large batch (up to 1000) in one
 * burst starves the JS thread — the slide-to-confirm loading state never
 * paints and the whole UI freezes until it finishes. Yielding
 * between chunks lets React commit the loading state and gives the UI thread
 * frames. Lower = smoother UI but more total overhead; tune as needed.
 */
export const SIGN_BATCH_SIZE = 16

export type PQSigningInfo = { schemeId: PQSchemeId; publicKey: Uint8Array }

export type LocalKeySigningDeps = {
    /**
     * Signs each payload with the child key at `keyPairId`, returning one
     * signature per payload in order. The caller owns key custody and the
     * access-domain check — this module never sees private material.
     */
    signPayloads: (
        keyPairId: string,
        payloads: Uint8Array[],
    ) => Promise<Uint8Array[]>
    /**
     * PQ scheme id + public key for a post-quantum child, or `null` for an
     * Ed25519 one. The single oracle for which payload and which envelope
     * field this module picks — see `useKMS.getPQSigningInfo` for why payload
     * selection and signer selection must never be able to disagree.
     */
    getPQSigningInfo: (keyPairId: string) => PQSigningInfo | null
    encodeTransaction: (txn: PeraTransaction) => Uint8Array
    /**
     * Yields to the event loop between batches. Injectable so a headless
     * caller can run the batching logic without React's scheduling in play.
     */
    yieldBetweenBatches?: () => Promise<void>
}

/**
 * Signs `txns` with `account`'s key and assembles the node-ready envelopes.
 *
 * Algo25, HD wallet, and quantum accounts all reference their signing key
 * directly via `keyPairId`. `getPQSigningInfo` is the single place that
 * resolves the key's scheme — everything else here (batching, rekey `sgnr`,
 * ordering) is shared regardless of which branch it picks.
 */
const signSingleAccountTransactions = async (
    deps: LocalKeySigningDeps,
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

    // The only scheme-dependent decision here: what bytes to sign, and which
    // field to put the signature in. Everything else — batching, rekey
    // `sgnr`, ordering — is shared. This is the same altitude as the
    // algo25-vs-HD difference, which the keystore resolves internally by
    // child type.
    const pqInfo = deps.getPQSigningInfo(account.keyPairId)
    const yieldBetweenBatches = deps.yieldBetweenBatches ?? deferToNextCycle

    const signed: PeraSignedTransaction[] = []

    for (let start = 0; start < txns.length; start += SIGN_BATCH_SIZE) {
        // Yield between chunks so the UI thread gets a frame and React can
        // paint the signing state. Skipped before the first chunk so
        // small/single signs keep their snappy, single-tick path.
        if (start > 0) {
            await yieldBetweenBatches()
        }

        const batch = txns.slice(start, start + SIGN_BATCH_SIZE)
        const payloads = pqInfo
            ? batch.map(txn => pqSigningDigest(txn))
            : batch.map(txn => deps.encodeTransaction(txn))
        const signatures = await deps.signPayloads(account.keyPairId, payloads)

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

            const senderPublicKey = encodeAlgorandAddress(txn.sender.publicKey)
            signed.push(
                new SignedTransaction({
                    txn,
                    sig: signatures[idx],
                    // A signer that is not the sender is the rekey case, and
                    // the envelope has to name it or the node cannot find the
                    // authorizing key.
                    sgnr:
                        account.address !== senderPublicKey
                            ? Address.fromString(account.address)
                            : undefined,
                }),
            )
        })
    }

    return signed
}

/**
 * Signs the transactions at `indexesToSign` with `account`'s key, leaving
 * every other slot as an unsigned envelope so the group's shape is preserved.
 *
 * The caller is responsible for resolving the correct account before calling:
 * for regular signing flows that means following rekey to the auth account;
 * for multisig cosign that means using the participant's own
 * (un-rekey-resolved) account. This signs with whatever account it receives
 * and does NOT follow rekey internally.
 *
 * Do NOT look the account up from `txn.sender`: for multisig cosign and
 * ARC-0001 explicit-`signers` flows, the signer differs from the transaction
 * sender, and lookup-by-sender would either pick the wrong account or none at
 * all.
 *
 * Pure and dependency-injected on purpose: this is the seam
 * `useLocalKeyTransactionSigner` delegates to, and the entry point the
 * LocalNet conformance suite signs through, so the `sgnr`/`pqsig` envelope
 * rules are proven against a real node rather than reimplemented by a test
 * harness.
 */
export const signTransactionsWithLocalKey = async (
    deps: LocalKeySigningDeps,
    txnGroup: PeraTransaction[],
    indexesToSign: number[],
    account: WalletAccount,
): Promise<PeraSignedTransaction[]> => {
    const result = txnGroup.map(txn => new SignedTransaction({ txn }))

    const toSign = indexesToSign.map(i => txnGroup[i])
    const signedTxns = await signSingleAccountTransactions(
        deps,
        account,
        toSign,
    )
    signedTxns.forEach((signedTxn, idx) => {
        result[indexesToSign[idx]] = signedTxn
    })
    return result
}
