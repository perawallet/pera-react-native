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
 * Cap the algokit createTransaction call. It internally fetches
 * `algod.suggestedParams()` to compute firstValid/lastValid rounds, which
 * can hang indefinitely if algod is unreachable. Without a bound the
 * dispatcher's `await` never resolves and the QR scanner Modal stays open
 * with no visible feedback.
 */
const KEYREG_BUILD_TIMEOUT_MS = 12_000

/**
 * Native pera QR generators emit unpadded base64 (a 32-byte key encodes to
 * 43 chars; standard base64 would pad to 44). `base64-js.toByteArray` —
 * what `decodeFromBase64` calls under the hood — requires the input length
 * to be a multiple of 4, so unpadded keys throw "Invalid string. Length
 * must be a multiple of 4". Re-pad before decoding so URL-safe and
 * unpadded forms both work.
 */
const decodeKeyregBase64 = (key: string): Uint8Array => {
    const padLen = (4 - (key.length % 4)) % 4
    return decodeFromBase64(key + '='.repeat(padLen))
}

/**
 * Builds a key-registration transaction from the deeplink payload (online
 * or offline) and submits it through the signing pipeline. SignRequestView
 * already renders a keyreg summary screen (see
 * packages/blockchain/src/utils/transactions.ts → keyregTransaction display
 * mapping) so the user reviews then signs without a separate UI here.
 *
 * Online keyreg requires every participation key field to be present —
 * partial deeplinks are rejected rather than producing a malformed txn.
 */
/**
 * Preflight: returns a reason string the deeplink error sheet should
 * surface if the user can't sign for `senderAddress`, or null if they can.
 * Mirrors what the signing pipeline's resolveInitialContext checks but at
 * the deeplink layer so we never queue a doomed sign request that lands
 * the user on a useless review/error sheet.
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
                // `BigInt()` throws on a malformed fee (non-numeric, decimal);
                // keep the coercion inside the try so a bad deeplink routes to
                // the error sheet instead of throwing uncaught out of the
                // handler. An out-of-range fee is caught at review time by the
                // signing pipeline's high-fee warning (see detectHighGroupFee).
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

                // Algokit's createTransaction returns a Transaction whose
                // sender is an `Address` instance (and several fields are
                // typed objects). The signing pipeline / display layer is
                // built around the shape produced by `decodeTransaction(bytes)`
                // — sender becomes a plain string, byte fields are
                // Uint8Array — so a raw algokit txn crashes with
                // `Buffer.from(...) received type object`. Encode then
                // decode to normalize.
                const normalizedTx = decodeTransaction(encodeTransaction(tx))
                // Floors a quantum sender's fee to the PQ minimum (mirrors
                // the WC/webview enqueue path); a non-quantum sender is a
                // free no-op — same reference, no network traffic.
                const { transactions, adjustments } = await assignFeeToGroup({
                    transactions: [normalizedTx],
                })
                // sourceType MUST be 'deeplink' (not 'local') so
                // SigningOverlays' interactive-source filter picks the
                // request up and shows the review sheet. 'local' is
                // headless — the originating screen owns its own
                // confirmation UI and the request would silently auto-sign
                // (or silently fail if no signer is available).
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
