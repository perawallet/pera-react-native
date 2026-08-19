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
import { getArc59SignedFundingAmount } from '../getArc59SignedFundingAmount'
import { ARC59Client } from '../clients'
import { requireArc59Config } from './requireArc59Config'
import { buildGroup } from '../utils'

import type { Arc59SendSummaryResponse } from '../api'

type SendViaInboxParams = {
    sender: string
    receiver: string
    assetId: bigint
    amount: bigint
    summary: Arc59SendSummaryResponse
    /**
     * µAlgo minimum fee for the sender's own (outer) transactions —
     * PQ-aware, resolved by the caller. Inner txns are app-authorized and
     * always pool at the network base fee.
     */
    senderMinFee: bigint
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
            const { sender, receiver, assetId, amount, summary, senderMinFee } =
                params
            const arc59Config = requireArc59Config(network)

            const suggestedParams = await algokit.getSuggestedParams()
            const minFee = BigInt(suggestedParams.minFee)
            const senderFee = senderMinFee > minFee ? senderMinFee : minFee
            // Only override AlgoKit's auto-sizing when the sender's rate is
            // raised (PQ signer), so a classical sender's group is unchanged.
            const outerFeeOverride =
                senderFee > minFee ? { staticFee: senderFee.microAlgo() } : {}

            const appClient = new ARC59Client({
                appId: arc59Config.appId,
                algorand: algokit,
                defaultSender: sender,
            })

            const composer = algokit.newGroup()

            // Payment = algo_fund_amount + minimum_balance_requirement. Shared
            // with the summary screen's display + balance-check so the amount
            // shown/checked can never diverge from the amount signed (PERA-4710).
            const totalPaymentAmount = getArc59SignedFundingAmount(summary)

            if (totalPaymentAmount > 0n) {
                composer.addPayment({
                    sender,
                    receiver: arc59Config.appAddress,
                    amount: totalPaymentAmount.microAlgo(),
                    ...outerFeeOverride,
                })
            }

            // Explicit references so the group builds without a live simulate,
            // which the production algod proxy rejects. Everything the router
            // touches is derivable client-side.
            //
            // The inbox account is referenced ONLY when it already exists: the
            // router reads its state, so it must be available. On a first send
            // the inbox is created inside the call as an inner txn, and an
            // account created in-call needs no pre-reference — referencing the
            // unknown address would fail.
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
                        ...(senderFee > minFee
                            ? { staticFee: (senderFee + minFee).microAlgo() }
                            : { extraFee: minFee.microAlgo() }),
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
                            ...outerFeeOverride,
                        }),
                        receiver,
                        0,
                    ],
                    ...(senderFee > minFee
                        ? {
                              staticFee: (
                                  senderFee +
                                  minFee * BigInt(summary.inner_tx_count)
                              ).microAlgo(),
                          }
                        : {
                              extraFee: (
                                  minFee * BigInt(summary.inner_tx_count)
                              ).microAlgo(),
                          }),
                    ...sendAssetRefs,
                }),
            )

            return buildGroup(composer)
        },
        [algokit, network],
    )

    return { buildSendViaInboxTxs }
}
