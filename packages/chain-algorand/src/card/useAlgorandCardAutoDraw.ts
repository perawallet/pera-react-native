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

import { useCallback, useMemo } from 'react'
import {
    DEFAULT_CARD_CURRENCY,
    postCardDelegation,
    type CardAutoDrawOperations,
} from '@perawallet/wallet-core-card'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    encodeProgramAccount,
    useProgramSigner,
    useSignAndSubmitGroup,
} from '@perawallet/wallet-core-signing'
import { encodeToBase64, logger } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { useFeeDelegation } from '../fee-delegation'
import { algorandNetworkOf } from '../legacy-network'
import { autoDrawDelegationRequest } from './delegation'
import { algorandAutoDraw } from './escrow/killswitch'
import { compileAutoDrawProgram, resolveEscrowChainConfig } from './escrow/lsig'

const fundingAddressOf = (
    account: WalletAccount,
    scope: ChainScope,
): string => {
    const address = chainAccountOf(account, scope.chainId)?.address
    if (address === undefined) {
        throw new Error(
            `The funding account has no address on ${scope.chainId}`,
        )
    }
    return address
}

/**
 * The AutoDraw LSig (compile → sign → register with AB, shared with
 * onboarding) plus the on-chain Killswitch enable/kill that actually
 * activates/deactivates auto-draw.
 */
export const useAlgorandCardAutoDraw = (): CardAutoDrawOperations => {
    const { signProgram } = useProgramSigner(
        useSelectedScope(ALGORAND_CHAIN_ID),
    )
    const { submit } = useSignAndSubmitGroup()
    const { submitWithFeeDelegation } = useFeeDelegation()

    const enableAutoDraw = useCallback(
        async (
            account: WalletAccount,
            cardAddress: string,
            scope: ChainScope,
        ): Promise<void> => {
            const network = algorandNetworkOf(scope)
            const address = fundingAddressOf(account, scope)

            // 1. Register the signed LSig with AB (its own ownership proof):
            // compile the pinned AutoDraw program, sign it with the funding
            // account's key, then POST the delegated LogicSig.
            const program = await compileAutoDrawProgram({ network })
            const lsigBytes = encodeProgramAccount(
                scope.chainId,
                program,
                await signProgram(account, program),
                address,
            )
            await postCardDelegation(
                autoDrawDelegationRequest({
                    currency: DEFAULT_CARD_CURRENCY.toLowerCase(),
                    delegatorAddress: address,
                    lsigBytes: encodeToBase64(lsigBytes),
                    cardAddress,
                }),
                scope,
            )

            // 2. Activate on-chain. Skipped until AB's Killswitch app is
            // configured (dev builds) — the LSig POST still exercises AB.
            if (!algorandAutoDraw.isConfigured(network)) {
                logger.warn(
                    'Killswitch not configured — skipping on-chain enable',
                )
                return
            }
            // Pre-check instead of tolerating ALREADY_ENABLED: the revert
            // fires during the resource-population simulate as an opaque
            // plain Error, so it can't be reliably detected after the fact.
            // Already enabled == the retry/recovery case — done. (A
            // concurrent enable between check and submit still reverts; that
            // surfaces as a retryable error and the retry no-ops.)
            const { assetId } = resolveEscrowChainConfig(network)
            if (
                await algorandAutoDraw.isEnabled({
                    network,
                    sender: address,
                    asset: assetId,
                })
            ) {
                return
            }
            const txns = await algorandAutoDraw.buildEnable({
                network,
                sender: address,
                cardAddress,
                asset: assetId,
            })
            // Fee-delegated: the sponsor covers the group's fees (the backend
            // simulates the group, so enable's inner getCardData call is
            // priced in) and tops the account up to min balance, so the
            // funding account needs no ALGO. The accounts-box MBR is funded by
            // the Killswitch app account, not the sponsor.
            await submitWithFeeDelegation({
                account: address,
                transactions: txns,
                includeAssetOptInMbr: true,
                sourceMetadata: {
                    name: 'card-autodraw-enable',
                    description: 'Enable auto funding',
                },
            })
        },
        [signProgram, submitWithFeeDelegation],
    )

    const disableAutoDraw = useCallback(
        async (account: WalletAccount, scope: ChainScope): Promise<void> => {
            const network = algorandNetworkOf(scope)
            if (!algorandAutoDraw.isConfigured(network)) {
                logger.warn(
                    'Killswitch not configured — skipping on-chain kill',
                )
                return
            }
            const address = fundingAddressOf(account, scope)
            // Pre-check instead of tolerating ALREADY_DISABLED (same
            // simulate-revert opacity as enable). No box == nothing to kill:
            // covers the retry case AND a persisted-Auto state whose on-chain
            // enable never happened (e.g. Auto chosen during onboarding,
            // which only registers the LSig) — switching to Manual must
            // succeed there, not dead-end on a revert.
            const { assetId } = resolveEscrowChainConfig(network)
            if (
                !(await algorandAutoDraw.isEnabled({
                    network,
                    sender: address,
                    asset: assetId,
                }))
            ) {
                return
            }
            const txns = await algorandAutoDraw.buildKill({
                network,
                sender: address,
                asset: assetId,
            })
            await submit({
                chainId: scope.chainId,
                unsignedTxs: txns,
                source: {
                    name: 'card-autodraw-disable',
                    description: 'Turn off auto funding',
                },
            })
        },
        [submit],
    )

    return useMemo(
        () => ({ enableAutoDraw, disableAutoDraw }),
        [enableAutoDraw, disableAutoDraw],
    )
}
