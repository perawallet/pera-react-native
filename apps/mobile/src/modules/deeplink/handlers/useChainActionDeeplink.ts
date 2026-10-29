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
    getChainDescriptor,
    getSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    ChainActionBuildError,
    deeplinkAdapters,
    DeeplinkType,
    type ChainActionDeeplink,
} from '@perawallet/wallet-core-deeplinks'
import {
    plannerChainAdapters,
    useMinimumFeeCalculatorFor,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import {
    findAccountByAddressOn,
    resolveSignerForAccount,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    generateOrderedUniqueId,
    logger,
    withTimeout,
} from '@perawallet/wallet-core-shared'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'
import { DeeplinkTimeoutError } from './timeout'

export type ChainActionDeeplinkHandler = (
    data: ChainActionDeeplink,
) => Promise<void>

const PARSED_TYPE = DeeplinkType.CHAIN_ACTION

/**
 * Building fetches the chain's fee parameters, which hangs indefinitely on an
 * unreachable node, leaving the dispatcher's `await` pending and the QR
 * scanner open with no feedback.
 */
const CHAIN_ACTION_BUILD_TIMEOUT_MS = 12_000

type Ineligible = {
    variant: 'chain-action-unknown-account' | 'chain-action-cannot-sign'
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
            variant: 'chain-action-unknown-account',
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
            variant: 'chain-action-unknown-account',
            reason: `Rekey target ${resolution.authorityAddress} is not in this wallet`,
        }
    }
    return {
        variant: 'chain-action-cannot-sign',
        reason: `Account ${senderAddress} cannot sign (${resolution.kind})`,
    }
}

export const useChainActionDeeplink = (): ChainActionDeeplinkHandler => {
    const { addSignRequest } = useSigningRequest()
    const allAccounts = useAllAccounts()
    const showError = useDeeplinkErrorHandler()
    const assignFeeFor = useMinimumFeeCalculatorFor()

    return useCallback(
        async ({ chainData, target }: ChainActionDeeplink) => {
            const buildChainAction = deeplinkAdapters.has(target.chainId)
                ? deeplinkAdapters.get(target.chainId).buildChainAction
                : undefined
            if (!buildChainAction) {
                showError({
                    variant: 'unsupported-on-chain',
                    parsedType: PARSED_TYPE,
                    values: {
                        chain: getChainDescriptor(target.chainId).displayName,
                    },
                })
                return
            }

            const scope = getSelectedScope(target.chainId)
            if (!addressCodecs.get(target.chainId).isValid(chainData.sender)) {
                showError({
                    variant: 'chain-action',
                    action: chainData.action,
                    parsedType: PARSED_TYPE,
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
                    action: chainData.action,
                    parsedType: PARSED_TYPE,
                    error: ineligible.reason,
                })
                return
            }

            // The dispatcher refuses this first; kept here because the txn is
            // built on the selected network and carries its genesis hash, so a
            // wrong-network action looks valid to every later check.
            if (target.networkId && target.networkId !== scope.networkId) {
                showError({
                    variant: 'network-mismatch',
                    parsedType: PARSED_TYPE,
                    error: `Deeplink targets ${target.networkId}, wallet is on ${scope.networkId}`,
                    values: {
                        network:
                            getChainDescriptor(target.chainId).networks.find(
                                ({ id }) => id === target.networkId,
                            )?.displayName ?? target.networkId,
                    },
                })
                return
            }

            try {
                const tx = await withTimeout(
                    buildChainAction(chainData, { scope }),
                    CHAIN_ACTION_BUILD_TIMEOUT_MS,
                    `${chainData.action}ChainAction`,
                    (operation, ms) => new DeeplinkTimeoutError(operation, ms),
                )

                // Adds a quantum sender's PQ surcharge (mirrors the WC/webview
                // enqueue path); a non-quantum sender is a free no-op — same
                // reference, no network traffic.
                const { transactions, adjustments } = await assignFeeFor(
                    scope.chainId,
                )({
                    transactions: [tx],
                })
                // MUST be 'deeplink', not 'local': only an interactive source
                // gets the review sheet. 'local' is headless and would silently
                // auto-sign, or silently fail with no signer.
                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    transport: 'network',
                    sourceType: 'deeplink',
                    txs: transactions,
                    chainData: plannerChainAdapters
                        .get(scope.chainId)
                        .signRequestChainData({
                            // An explicit link fee we raised is surfaced as an
                            // adjustment (original → new, matching the WC
                            // path); a fee we filled in ourselves when the
                            // link omitted one is Pera-set, not an override —
                            // no delta to show.
                            feeAdjustments:
                                chainData.fee !== undefined &&
                                adjustments.length > 0
                                    ? adjustments
                                    : undefined,
                        }),
                })
            } catch (error) {
                if (error instanceof ChainActionBuildError) {
                    showError({
                        variant: 'chain-action',
                        action: chainData.action,
                        parsedType: PARSED_TYPE,
                        error: error.message,
                    })
                    return
                }
                logger.error('[deeplink/chain-action] failed', { error })
                showError({
                    variant: 'chain-action',
                    action: chainData.action,
                    parsedType: PARSED_TYPE,
                    error,
                })
            }
        },
        [addSignRequest, allAccounts, assignFeeFor, showError],
    )
}
