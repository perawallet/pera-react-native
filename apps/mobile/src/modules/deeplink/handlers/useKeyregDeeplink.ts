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
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { ChainActionDeeplink } from '@perawallet/wallet-core-deeplinks'
import {
    useMinimumFeeCalculator,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { buildKeyRegistrationTx } from '@perawallet/wallet-core-transactions'
import {
    findAccountByAddressOn,
    resolveSignerForAccount,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    decodeFromBase64,
    generateOrderedUniqueId,
    logger,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'
import { withTimeout } from './timeout'

export type KeyregDeeplinkHandler = (data: ChainActionDeeplink) => Promise<void>

/**
 * Building the transaction fetches `suggestedParams()` internally, which hangs
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

type Ineligible = {
    variant: 'keyreg-unknown-account' | 'keyreg-cannot-sign'
    reason: string
}

/**
 * Mirrors the pipeline's `resolveInitialContext` checks at the deeplink layer,
 * so a doomed request never gets queued into a useless review sheet.
 *
 * Delegates to `resolveSignerForAccount` — the same resolution the pipeline
 * uses — rather than re-deriving it. Checking only that the account exists and
 * its rekey chain resolves let a watch-only sender through, which the node
 * runner's setup makes likely; the pipeline then threw at machine init and the
 * user got a bare "Signing failed" with the sheet already open.
 *
 * The two rejections are NOT interchangeable: an absent account (or rekey
 * target) is fixable by adding it, whereas a watch-only one is in the wallet
 * already and needs its key instead.
 */
const checkSigningEligibility = (
    senderAddress: string,
    accounts: WalletAccount[],
    chainId: ChainId,
): Ineligible | null => {
    const account = findAccountByAddressOn(accounts, chainId, senderAddress)
    if (!account) {
        return {
            variant: 'keyreg-unknown-account',
            reason: `Account ${senderAddress} is not in this wallet`,
        }
    }

    // Judged on the RESOLVED signer, so a signable account rekeyed to an
    // unsignable one is rejected too.
    const resolution = resolveSignerForAccount(account, accounts, chainId)
    if (resolution.kind === 'ok') {
        return null
    }
    if (resolution.kind === 'authMissing') {
        return {
            variant: 'keyreg-unknown-account',
            reason: `Rekey target ${resolution.authorityAddress} is not in this wallet`,
        }
    }
    return {
        variant: 'keyreg-cannot-sign',
        reason: `Account ${senderAddress} cannot sign (${resolution.kind})`,
    }
}

export const useKeyregDeeplink = (): KeyregDeeplinkHandler => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { addSignRequest } = useSigningRequest()
    const allAccounts = useAllAccounts()
    const showError = useDeeplinkErrorHandler()
    const { assignFeeToGroup } = useMinimumFeeCalculator(scope.chainId)

    return useCallback(
        async ({ chainData, target }: ChainActionDeeplink) => {
            if (!addressCodecs.get(scope.chainId).isValid(chainData.sender)) {
                showError({
                    variant: 'keyreg',
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
                chainData.sender,
                allAccounts,
                scope.chainId,
            )
            if (ineligible) {
                showError({
                    variant: ineligible.variant,
                    parsedType: 'KEYREG',
                    error: ineligible.reason,
                })
                return
            }

            // The transaction is built against the ACTIVE network, so a
            // cross-chain scan produces a valid-looking txn for the wrong
            // chain that no downstream genesis-hash check can catch. Fail
            // closed on anything that doesn't name the active network.
            if (target.networkId && target.networkId !== scope.networkId) {
                showError({
                    variant: 'keyreg-network-mismatch',
                    parsedType: 'KEYREG',
                    error: `Deeplink targets ${target.networkId}, wallet is on ${scope.networkId}`,
                })
                return
            }

            try {
                // Editable note + locked xnote both end up in the txn note.
                // Native shows xnote read-only in its review UI; the signing
                // modal here just displays the resulting note string.
                const note = chainData.note ?? chainData.xnote
                const noteBytes = note
                    ? new TextEncoder().encode(note)
                    : undefined
                // `BigInt()` throws on a malformed round or dilution, so keep the
                // coercion inside the try — a bad deeplink should reach the error
                // sheet, not throw out of the handler. An out-of-range fee is
                // caught at review time by the high-fee warning.
                const dAppFee = chainData.fee
                    ? toBigInt(chainData.fee)
                    : undefined

                let tx
                if (chainData.keyregType === 'offline') {
                    tx = await withTimeout(
                        'offlineKeyRegistration',
                        KEYREG_BUILD_TIMEOUT_MS,
                        buildKeyRegistrationTx({
                            kind: 'offline',
                            scope,
                            sender: chainData.sender,
                            note: noteBytes,
                            fee: dAppFee,
                        }),
                    )
                } else {
                    if (
                        !chainData.voteKey ||
                        !chainData.selectionKey ||
                        !chainData.stateProofKey ||
                        !chainData.voteFirst ||
                        !chainData.voteLast ||
                        !chainData.voteKeyDilution
                    ) {
                        showError({
                            variant: 'keyreg',
                            parsedType: 'KEYREG',
                            error: 'Missing required participation key fields',
                        })
                        return
                    }
                    tx = await withTimeout(
                        'onlineKeyRegistration',
                        KEYREG_BUILD_TIMEOUT_MS,
                        buildKeyRegistrationTx({
                            kind: 'online',
                            scope,
                            sender: chainData.sender,
                            voteKey: decodeKeyregBase64(chainData.voteKey),
                            selectionKey: decodeKeyregBase64(
                                chainData.selectionKey,
                            ),
                            stateProofKey: decodeKeyregBase64(
                                chainData.stateProofKey,
                            ),
                            voteFirst: BigInt(chainData.voteFirst),
                            voteLast: BigInt(chainData.voteLast),
                            voteKeyDilution: BigInt(chainData.voteKeyDilution),
                            note: noteBytes,
                            fee: dAppFee,
                        }),
                    )
                }

                // Adds a quantum sender's PQ surcharge (mirrors the WC/webview
                // enqueue path); a non-quantum sender is a free no-op — same
                // reference, no network traffic.
                const { transactions, adjustments } = await assignFeeToGroup({
                    transactions: [tx],
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
                    chainData: {
                        algorand: {
                            // An explicit dApp fee we raised is surfaced as an
                            // adjustment (original → new, matching the WC
                            // path); a fee we filled in ourselves when the
                            // deeplink omitted one is Pera-set, not an
                            // override — no delta to show.
                            feeAdjustments:
                                dAppFee !== undefined && adjustments.length > 0
                                    ? adjustments
                                    : undefined,
                        },
                    },
                })
            } catch (error) {
                logger.error('[deeplink/keyreg] failed', { error })
                showError({
                    variant: 'keyreg',
                    parsedType: 'KEYREG',
                    error,
                })
            }
        },
        [addSignRequest, allAccounts, assignFeeToGroup, showError, scope],
    )
}
