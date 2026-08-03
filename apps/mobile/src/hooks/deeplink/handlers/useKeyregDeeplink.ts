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
import { microAlgo } from '@algorandfoundation/algokit-utils'
import {
    isValidAlgorandAddress,
    useAlgorandClient,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    useMinimumFeeCalculator,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    resolveAuthAccount,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    decodeFromBase64,
    generateOrderedUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'
import { withTimeout } from './timeout'
import type { KeyregDeeplink } from '../types'

export type KeyregDeeplinkHandler = (data: KeyregDeeplink) => Promise<void>

/**
 * `createTransaction` fetches `suggestedParams()` internally, which hangs
 * indefinitely on an unreachable algod — leaving the dispatcher's `await`
 * pending and the QR scanner open with no feedback.
 */
const KEYREG_BUILD_TIMEOUT_MS = 12_000

/**
 * Native QR generators emit unpadded base64 (a 32-byte key is 43 chars, not
 * 44), which `base64-js` rejects — it needs a length divisible by 4. Re-pad so
 * URL-safe and unpadded forms both decode.
 */
const decodeKeyregBase64 = (key: string): Uint8Array => {
    const padLen = (4 - (key.length % 4)) % 4
    return decodeFromBase64(key + '='.repeat(padLen))
}

/**
 * SignRequestView already renders a keyreg summary, so there's no separate
 * review UI here. Online keyreg needs every participation key field — a partial
 * deeplink is rejected rather than producing a malformed txn.
 */
/**
 * Mirrors the pipeline's `resolveInitialContext` checks at the deeplink layer,
 * so a doomed request never gets queued into a useless review sheet.
 */
const checkSigningEligibility = (
    senderAddress: string,
    accounts: WalletAccount[],
): { reason: string } | null => {
    const account = accounts.find(a => a.address === senderAddress)
    if (!account) {
        return {
            reason: `Account ${senderAddress} is not in this wallet`,
        }
    }
    try {
        // Throws RekeyTargetNotFoundError when the account is rekeyed
        // and the rekey target is also missing.
        resolveAuthAccount(account, accounts)
        return null
    } catch (err) {
        return {
            reason: err instanceof Error ? err.message : String(err),
        }
    }
}

export const useKeyregDeeplink = (): KeyregDeeplinkHandler => {
    const algorandClient = useAlgorandClient()
    const { encodeTransaction, decodeTransaction } = useTransactionEncoder()
    const { addSignRequest } = useSigningRequest()
    const allAccounts = useAllAccounts()
    const showError = useDeeplinkErrorHandler()
    const { assignFeeToGroup } = useMinimumFeeCalculator()

    return useCallback(
        async (data: KeyregDeeplink) => {
            if (!isValidAlgorandAddress(data.senderAddress)) {
                showError({
                    variant: 'keyreg',
                    sourceUrl: data.sourceUrl,
                    parsedType: 'KEYREG',
                    error: 'Invalid sender address',
                })
                return
            }

            // Preflight signing eligibility before queueing — otherwise the
            // user sees the signing sheet open with a cryptic pipeline
            // error ("No signable transactions found", "Rekey target not
            // found in local accounts") and has to dismiss multiple times.
            const ineligible = checkSigningEligibility(
                data.senderAddress,
                allAccounts,
            )
            if (ineligible) {
                showError({
                    variant: 'keyreg-unknown-account',
                    sourceUrl: data.sourceUrl,
                    parsedType: 'KEYREG',
                    error: ineligible.reason,
                })
                return
            }

            try {
                // Editable note + locked xnote both end up in the txn note.
                // Native shows xnote read-only in its review UI; the signing
                // modal here just displays the resulting note string.
                const note = data.note ?? data.xnote
                const noteBytes = note
                    ? new TextEncoder().encode(note)
                    : undefined
                // `BigInt()` throws on a malformed fee, so keep the coercion
                // inside the try — a bad deeplink should reach the error sheet,
                // not throw out of the handler. An out-of-range fee is caught at
                // review time by the high-fee warning.
                const dAppFee = data.fee ? BigInt(data.fee) : undefined
                const staticFee =
                    dAppFee !== undefined ? microAlgo(dAppFee) : undefined

                let tx
                if (data.keyregType === 'offline') {
                    tx = await withTimeout(
                        'offlineKeyRegistration',
                        KEYREG_BUILD_TIMEOUT_MS,
                        algorandClient.createTransaction.offlineKeyRegistration(
                            {
                                sender: data.senderAddress,
                                note: noteBytes,
                                staticFee,
                            },
                        ),
                    )
                } else {
                    if (
                        !data.voteKey ||
                        !data.selkey ||
                        !data.sprfkey ||
                        !data.votefst ||
                        !data.votelst ||
                        !data.votekd
                    ) {
                        showError({
                            variant: 'keyreg',
                            sourceUrl: data.sourceUrl,
                            parsedType: 'KEYREG',
                            error: 'Missing required participation key fields',
                        })
                        return
                    }
                    tx = await withTimeout(
                        'onlineKeyRegistration',
                        KEYREG_BUILD_TIMEOUT_MS,
                        algorandClient.createTransaction.onlineKeyRegistration({
                            sender: data.senderAddress,
                            voteKey: decodeKeyregBase64(data.voteKey),
                            selectionKey: decodeKeyregBase64(data.selkey),
                            stateProofKey: decodeKeyregBase64(data.sprfkey),
                            voteFirst: BigInt(data.votefst),
                            voteLast: BigInt(data.votelst),
                            voteKeyDilution: BigInt(data.votekd),
                            note: noteBytes,
                            staticFee,
                        }),
                    )
                }

                // Encode-then-decode to normalize: algokit returns a sender as
                // an `Address` instance, but the pipeline is built around
                // `decodeTransaction(bytes)`'s shape (plain string sender,
                // Uint8Array byte fields) and otherwise crashes with
                // `Buffer.from(...) received type object`.
                const normalizedTx = decodeTransaction(encodeTransaction(tx))
                // Floors a quantum sender's fee to the PQ minimum (mirrors
                // the WC/webview enqueue path); a non-quantum sender is a
                // free no-op — same reference, no network traffic.
                const { transactions, adjustments } = await assignFeeToGroup({
                    transactions: [normalizedTx],
                })
                // MUST be 'deeplink', not 'local': only an interactive source
                // gets the review sheet. 'local' is headless and would silently
                // auto-sign, or silently fail with no signer.
                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'algod',
                    sourceType: 'deeplink',
                    txs: transactions,
                    // An explicit dApp fee we raised is surfaced as an
                    // adjustment (original → new, matching the WC path); a
                    // fee we filled in ourselves when the deeplink omitted
                    // one is Pera-set, not an override — no delta to show.
                    feeAdjustments:
                        dAppFee !== undefined && adjustments.length > 0
                            ? adjustments
                            : undefined,
                })
            } catch (error) {
                logger.error('[deeplink/keyreg] failed', { error })
                showError({
                    variant: 'keyreg',
                    sourceUrl: data.sourceUrl,
                    parsedType: 'KEYREG',
                    error,
                })
            }
        },
        [
            addSignRequest,
            algorandClient,
            allAccounts,
            assignFeeToGroup,
            decodeTransaction,
            encodeTransaction,
            showError,
        ],
    )
}
