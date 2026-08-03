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

import { useCallback } from 'react'
import {
    compactSignedResults,
    useAlgorandClient,
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    submitAndAutoRefresh,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import { getValidIntegrityToken } from '@perawallet/wallet-core-app-integrity'
import { isDev, isStaging } from '@perawallet/wallet-core-config'
import {
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
} from '@perawallet/wallet-core-shared'

import { requestFeeDelegation } from '../api'
import {
    FeeDelegationAttestationRequiredError,
    FeeDelegationResponseMismatchError,
} from '../errors'
import { returnedTransactionsMatchSent } from '../utils'

export type FeeDelegatedSubmitParams = {
    /** The wallet account whose transactions are being sponsored. */
    account: string
    /**
     * The UNSIGNED wallet transactions to sponsor. The backend prepends its
     * sponsor payment and re-groups everything (the group id changes), so
     * nothing may be signed before the response comes back.
     */
    transactions: PeraTransaction[]
    /**
     * Also top the account up to its minimum balance, including new asset
     * opt-ins. Named after the backend field; box/app-storage MBR is out of
     * its scope.
     */
    includeAssetOptInMbr?: boolean
    /** Asset ids of the opt-in transactions contained in `transactions`. */
    optInAssetIds?: bigint[]
    /** Source metadata shown in the signing sheet for the wallet slot(s). */
    sourceMetadata: TransactionSignRequest['sourceMetadata']
}

export type UseFeeDelegationResult = {
    submitWithFeeDelegation: (params: FeeDelegatedSubmitParams) => Promise<void>
}

/**
 * A slot in the server re-grouped group: either the sponsor's pre-signed
 * transaction (passed straight through to algod) or an unsigned wallet
 * transaction that must be signed against the NEW group id.
 */
type GroupSlot =
    | { kind: 'preSigned'; signed: PeraSignedTransaction }
    | { kind: 'toSign'; flatIndex: number }

/**
 * Hand the wallet-signable slot(s) to the signing pipeline as a headless
 * callback request and resolve with the signed bytes. `groupContext` is the
 * full re-grouped payload (sponsor pre-signed + wallet txns) so the pipeline's
 * group-integrity check recomputes the hash over what the sponsor signed.
 */
const requestSignatures = (
    addSignRequest: (request: TransactionSignRequest) => void,
    unsignedTxs: PeraTransaction[],
    groupContext: PeraTransaction[],
    signableIndices: number[],
    sourceMetadata: TransactionSignRequest['sourceMetadata'],
): Promise<PeraSignedTransaction[]> =>
    new Promise((resolve, reject) => {
        const request: TransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs: unsignedTxs,
            groupContext,
            signableIndices,
            sourceMetadata,
            approve: async signed => {
                // Single full-group headless sign (no per-slot padding), so
                // every entry is expected to be present — the null filter is
                // defensive only. A quantum signature is just a
                // `PeraSignedTransaction` with `pqsig` set, so it flows
                // through the ordinary submitAndAutoRefresh path unchanged.
                resolve(compactSignedResults(signed))
            },
            reject: async () => {
                reject(new Error('User rejected fee-delegated signing'))
            },
            error: async (err: Error) => {
                reject(err)
            },
        }
        addSignRequest(request)
    })

/**
 * Submits a transaction group with backend-sponsored fees (and optionally MBR
 * funding) via `POST /api/v3/fee-delegation`:
 *
 * 1. Requires a valid app-integrity attestation token (the route sits behind
 *    the integrity guard) — throws `FeeDelegationAttestationRequiredError`
 *    when none is available. Dev/staging builds are exempt: `requestFeeDelegation`
 *    sends a backend-recognized bypass header there instead (dev builds never
 *    register an attestation at all — see registerAppIntegrity.ts).
 * 2. Sends the unsigned group; the backend adds a sponsor fee/MBR-paying
 *    transaction and RE-GROUPS it (changing the group id); only AFTER
 *    receiving the re-grouped txns are the wallet slots signed.
 * 3. Sponsor slots come back pre-signed (`stxn`); wallet slots are signed
 *    through the signing pipeline, scattered back into submission order, and
 *    submitted.
 */
export const useFeeDelegation = (): UseFeeDelegationResult => {
    const algokit = useAlgorandClient()
    const { network } = useNetwork()
    const { addSignRequest } = useSigningRequest()
    const {
        encodeTransaction,
        encodeSignedTransactions,
        decodeTransaction,
        decodeSignedTransaction,
    } = useTransactionEncoder()

    const submitWithFeeDelegation = useCallback(
        async ({
            account,
            transactions,
            includeAssetOptInMbr = false,
            optInAssetIds = [],
            sourceMetadata,
        }: FeeDelegatedSubmitParams): Promise<void> => {
            const integrityToken = getValidIntegrityToken()
            if (!integrityToken && !(isDev || isStaging)) {
                throw new FeeDelegationAttestationRequiredError()
            }

            const { txnGroup } = await requestFeeDelegation(
                {
                    txnGroup: transactions.map(txn => ({
                        txn: encodeToBase64(encodeTransaction(txn)),
                    })),
                    account,
                    includeAssetOptInMbr,
                    optInAssetIds: optInAssetIds.map(id => id.toString()),
                },
                integrityToken ?? '',
                network,
            )

            // Decode the re-grouped txns into a merge plan: slots carrying
            // `stxn` are sponsor-signed; the rest are the wallet's own and
            // must be signed AFTER the re-group.
            const slots: GroupSlot[] = []
            const unsignedTxs: PeraTransaction[] = []
            const groupContext: PeraTransaction[] = []

            for (const entry of txnGroup) {
                if (entry.stxn) {
                    const signed = decodeSignedTransaction(
                        decodeFromBase64(entry.stxn),
                    )
                    slots.push({ kind: 'preSigned', signed })
                    groupContext.push(signed.txn)
                } else {
                    const unsignedTxn = decodeTransaction(
                        decodeFromBase64(entry.txn),
                    )
                    slots.push({
                        kind: 'toSign',
                        flatIndex: unsignedTxs.length,
                    })
                    unsignedTxs.push(unsignedTxn)
                    groupContext.push(unsignedTxn)
                }
            }

            // Trust-anchor check: a non-custodial wallet must never sign a
            // transaction it did not build. The backend legitimately re-groups
            // (so the group id changes), but every to-sign slot it hands back
            // must otherwise be byte-identical to a transaction the wallet sent,
            // in order, and sent by `account`. Reject the whole group otherwise
            // — a compromised backend or TLS MITM must not be able to substitute
            // an attacker-favorable transaction into the wallet's slot.
            if (
                !returnedTransactionsMatchSent({
                    sent: transactions,
                    returnedToSign: unsignedTxs,
                    account,
                    encodeTransaction,
                })
            ) {
                throw new FeeDelegationResponseMismatchError()
            }

            const signableIndices = slots.reduce<number[]>(
                (indices, slot, index) => {
                    if (slot.kind === 'toSign') {
                        indices.push(index)
                    }
                    return indices
                },
                [],
            )

            const flatSigned = await requestSignatures(
                addSignRequest,
                unsignedTxs,
                groupContext,
                signableIndices,
                sourceMetadata,
            )

            // Scatter the wallet signatures back into submission order,
            // interleaved with the sponsor's pre-signed slots, and submit.
            const orderedSigned = slots.map(slot =>
                slot.kind === 'preSigned'
                    ? slot.signed
                    : flatSigned[slot.flatIndex]!,
            )

            await submitAndAutoRefresh(
                algokit,
                encodeSignedTransactions,
                orderedSigned,
            )
        },
        [
            algokit,
            network,
            addSignRequest,
            encodeTransaction,
            encodeSignedTransactions,
            decodeTransaction,
            decodeSignedTransaction,
        ],
    )

    return { submitWithFeeDelegation }
}
