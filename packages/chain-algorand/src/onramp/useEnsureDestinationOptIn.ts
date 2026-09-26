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
import {
    useAlgorandClient,
    useMinimumFeeConfig,
} from '@perawallet/wallet-core-blockchain'
import {
    FeeDelegationAttestationRequiredError,
    useFeeDelegation,
} from '@perawallet/wallet-core-fee-delegation'
import {
    RampAttestationRequiredError,
    type EnsureCanReceive,
    type EnsureCanReceiveParams,
} from '@perawallet/wallet-core-onramp'
import { ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'

export type UseEnsureDestinationOptInResult = {
    ensureOptIn: EnsureCanReceive
}

const SOURCE = {
    name: 'onramp-opt-in',
    description: 'Opt in to the destination asset before funding',
}

/**
 * Ensures the receiving account is opted into the destination asset before an
 * onramp order is created.
 *
 * Decision tree:
 * 1. ALGO destination needs no opt-in.
 * 2. Already opted in → no-op.
 * 3. Not opted in + enough spare ALGO → self-funded opt-in.
 * 4. Not opted in + insufficient ALGO → fee-delegated opt-in via
 *    `@perawallet/wallet-core-fee-delegation` (sponsor covers fees + MBR;
 *    requires a valid device attestation token, throws the onramp's
 *    `RampAttestationRequiredError` otherwise). The opt-in itself is built
 *    with a zero fee — the sponsor tops the group's fee pool up to the full
 *    requirement, so the (underfunded) account pays nothing.
 *
 * Paths 3 and 4 run the `confirmOptIn` gate first when provided.
 */
export const useEnsureDestinationOptIn =
    (): UseEnsureDestinationOptInResult => {
        const algokit = useAlgorandClient()
        const { optIn } = useAssetOptInMutation()
        const { submitWithFeeDelegation } = useFeeDelegation()
        const { assetMbr } = useMinimumFeeConfig()

        const ensureOptIn = useCallback(
            async ({
                address,
                destinationAssetId,
                confirmOptIn,
            }: EnsureCanReceiveParams): Promise<boolean> => {
                // 1. ALGO never requires an opt-in.
                if (destinationAssetId === ALGO_ASSET_NAME) {
                    return true
                }
                const assetId = destinationAssetId

                // 2. Already opted in → nothing to do.
                const accountInfo = await algokit.client.algod
                    .accountInformation(address)
                    .do()
                const isOptedIn = accountInfo.assets?.some(
                    a => a.assetId === assetId,
                )
                if (isOptedIn) {
                    return true
                }

                // 3. Enough spare ALGO → self-funded opt-in (matches the
                // balance formula used by useAssetOptInMutation).
                const suggestedParams = await algokit.getSuggestedParams()
                const balanceNeeded =
                    accountInfo.minBalance +
                    assetMbr +
                    BigInt(suggestedParams.minFee)
                const isSponsored = accountInfo.amount < balanceNeeded

                if (confirmOptIn) {
                    const confirmed = await confirmOptIn({
                        assetId,
                        isSponsored,
                    })
                    if (!confirmed) {
                        return false
                    }
                }

                if (!isSponsored) {
                    await optIn({ sender: address, assetId })
                    return true
                }

                // 4. Insufficient ALGO → fee-delegated opt-in. The opt-in
                // carries a ZERO fee: the sponsor tops the group's fee pool up
                // to the full requirement (top-up-shortfall policy), and the
                // account can't afford a fee of its own anyway.
                const composer = algokit.newGroup()
                composer.addAssetOptIn({
                    sender: address,
                    assetId,
                    staticFee: AlgoAmount.MicroAlgo(0),
                })
                const { transactions } = await composer.build()

                try {
                    await submitWithFeeDelegation({
                        account: address,
                        transactions: transactions.map(t => t.txn),
                        includeAssetOptInMbr: true,
                        optInAssetIds: [assetId],
                        sourceMetadata: SOURCE,
                    })
                } catch (error) {
                    if (
                        error instanceof FeeDelegationAttestationRequiredError
                    ) {
                        throw new RampAttestationRequiredError()
                    }
                    throw error
                }
                return true
            },
            [algokit, optIn, submitWithFeeDelegation, assetMbr],
        )

        return { ensureOptIn }
    }
