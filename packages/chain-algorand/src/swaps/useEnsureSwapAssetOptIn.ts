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
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { EnsureSwapReceivable } from '@perawallet/wallet-core-swaps'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { useAlgorandClient, useMinimumFeeConfig } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { useFeeDelegation } from '../fee-delegation'
import { isAlgorandNativeAssetId } from '../descriptor'
import { toUnsignedAlgorandTransactions } from '../signing/unsignedTransaction'

export type EnsureAssetOptInParams = Parameters<EnsureSwapReceivable>[0] & {
    /** Asked once an opt-in is needed; declining leaves the account as it was. */
    confirm?: (details: {
        assetId: string
        isSponsored: boolean
    }) => Promise<boolean>
    sourceMetadata?: { name: string; description: string }
}

const SOURCE = {
    name: 'swap-opt-in',
    description: 'Opt in to the asset a swap pays out',
}

/**
 * Readies an account to hold an asset. Already opted in: nothing to do. Enough
 * spare ALGO: a self-funded opt-in. Otherwise a fee-delegated one, built with a
 * zero fee: the sponsor tops the group's fee pool up to the full requirement,
 * and the account can't afford a fee of its own. Throws
 * `FeeDelegationAttestationRequiredError` without a valid attestation.
 */
export const useEnsureAssetOptIn = (): ((
    params: EnsureAssetOptInParams,
) => Promise<boolean>) => {
    const algokit = useAlgorandClient()
    // The scope `algokit` builds for, so the payload's genesis matches it.
    const selectedScope = useSelectedScope(ALGORAND_CHAIN_ID)
    const { optIn } = useAssetOptInMutation(selectedScope)
    const { submitWithFeeDelegation } = useFeeDelegation()
    const { assetMbr } = useMinimumFeeConfig()

    return useCallback(
        async ({ address, assetId, confirm, sourceMetadata = SOURCE }) => {
            if (isAlgorandNativeAssetId(assetId)) return true
            const asa = BigInt(assetId)

            const accountInfo = await algokit.client.algod
                .accountInformation(address)
                .do()
            if (accountInfo.assets?.some(a => a.assetId === asa)) return true

            // Matches the balance formula used by useAssetOptInMutation.
            const suggestedParams = await algokit.getSuggestedParams()
            const balanceNeeded =
                accountInfo.minBalance +
                assetMbr +
                BigInt(suggestedParams.minFee)
            const isSponsored = accountInfo.amount < balanceNeeded

            if (confirm && !(await confirm({ assetId, isSponsored }))) {
                return false
            }

            if (!isSponsored) {
                await optIn({ sender: address, assetId: asa })
                return true
            }

            const composer = algokit.newGroup()
            composer.addAssetOptIn({
                sender: address,
                assetId: asa,
                staticFee: AlgoAmount.MicroAlgo(0),
            })
            const { transactions } = await composer.build()

            await submitWithFeeDelegation({
                account: address,
                transactions: toUnsignedAlgorandTransactions(
                    transactions.map(t => t.txn),
                    selectedScope,
                ),
                includeAssetOptInMbr: true,
                optInAssetIds: [asa],
                sourceMetadata,
            })
            return true
        },
        [algokit, optIn, submitWithFeeDelegation, assetMbr, selectedScope],
    )
}

export const useEnsureSwapAssetOptIn = (): EnsureSwapReceivable =>
    useEnsureAssetOptIn()
