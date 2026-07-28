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
import { decodeAddress } from 'algosdk'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { getArc59Config } from '@perawallet/wallet-core-config'
import type { Arc59SendSummaryResponse } from '../api'
import { ARC59Client } from '../clients'
import { buildGroup } from '../utils'

type SendViaInboxParams = {
    sender: string
    receiver: string
    assetId: bigint
    amount: bigint
    summary: Arc59SendSummaryResponse
}

type UseArc59SendTransactionResult = {
    buildSendViaInboxTxs: (
        params: SendViaInboxParams,
    ) => Promise<PeraTransaction[]>
}

export const useArc59SendTransaction = (): UseArc59SendTransactionResult => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()

    const buildSendViaInboxTxs = useCallback(
        async (params: SendViaInboxParams): Promise<PeraTransaction[]> => {
            const { sender, receiver, assetId, amount, summary } = params
            const arc59Config = getArc59Config(network)

            const suggestedParams = await algokit.getSuggestedParams()
            const minFee = BigInt(suggestedParams.minFee)

            const appClient = new ARC59Client({
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()

            // Payment = algo_fund_amount + minimum_balance_requirement
            const totalPaymentAmount =
                BigInt(summary.algo_fund_amount) +
                BigInt(summary.minimum_balance_requirement)

            if (totalPaymentAmount > 0n) {
                composer.addPayment({
                    sender,
                    receiver: arc59Config.appAddress,
                    amount: totalPaymentAmount.microAlgo(),
                })
            }

            // Attach the ARC-59 resource references explicitly so the group
            // always builds WITHOUT a live simulate (`populateAppCallResources`),
            // which the production algod proxy rejects. Everything the router
            // touches is derivable client-side: the router box is keyed by the
            // receiver's (recipient's) public key, and the asset is known.
            //
            // The receiver's inbox account is referenced ONLY when it already
            // exists (`summary.inbox_address`): the router reads the existing
            // inbox's state, so it must be available. On a first send the inbox
            // does not exist yet and is created inside `arc59_sendAsset` (inner
            // txn) — an account created in-call is available without being
            // pre-referenced, so it must be omitted (referencing the
            // zero/unknown address would fail). `receiver` alone is enough
            // there. Verified on-chain against a simulate-blocked node for both
            // the fresh-receiver and existing-inbox cases.
            const inboxAddress = summary.inbox_address
            const receiverBox = {
                appId: arc59Config.appId,
                name: decodeAddress(receiver).publicKey,
            }
            const optRouterInRefs = { assetReferences: [assetId] }
            const sendAssetRefs = {
                accountReferences: inboxAddress
                    ? [receiver, inboxAddress]
                    : [receiver],
                assetReferences: [assetId],
                boxReferences: [receiverBox],
            }

            // If router is not opted into the asset, include opt-in in the atomic group
            if (!summary.is_arc59_opted_in) {
                composer.addAppCallMethodCall(
                    await appClient.params.arc59_optRouterIn({
                        args: [assetId],
                        extraFee: minFee.microAlgo(),
                        ...optRouterInRefs,
                    }),
                )
            }

            // Call arc59_sendAsset with fee pooling for inner transactions
            // The axfer arg is automatically added to the group by AlgoKit
            composer.addAppCallMethodCall(
                await appClient.params.arc59_sendAsset({
                    args: [
                        await algokit.createTransaction.assetTransfer({
                            sender,
                            receiver: arc59Config.appAddress,
                            amount,
                            assetId,
                        }),
                        receiver,
                        0,
                    ],
                    extraFee: (
                        minFee * BigInt(summary.inner_tx_count)
                    ).microAlgo(),
                    ...sendAssetRefs,
                }),
            )

            return buildGroup(composer)
        },
        [algokit, network],
    )

    return { buildSendViaInboxTxs }
}
