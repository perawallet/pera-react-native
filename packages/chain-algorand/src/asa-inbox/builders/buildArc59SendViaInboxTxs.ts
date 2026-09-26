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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { decodeAddress } from 'algosdk'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'
import { getArc59SignedFundingAmount } from '../getArc59SignedFundingAmount'
import { ARC59Client } from '../clients'
import { requireArc59Config } from './requireArc59Config'
import { buildGroup } from '../utils'

import type { Arc59SendSummaryResponse } from '../api'

export type Arc59SendViaInboxParams = {
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

export type Arc59BuildContext = {
    algokit: AlgorandClient
    network: Network
}

export const buildArc59SendViaInboxTxs = async (
    { algokit, network }: Arc59BuildContext,
    params: Arc59SendViaInboxParams,
): Promise<PeraTransaction[]> => {
    const { sender, receiver, assetId, amount, summary, senderMinFee } = params
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
    // shown/checked can never diverge from the amount signed.
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
        accountReferences: inboxAddress ? [receiver, inboxAddress] : [receiver],
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

    // additionalReceiverFunds: the router forwards this to the
    // receiver's inbox, and it is what lets a receiver too poor to
    // afford the claim's opt-in claim at all. The payment above
    // already includes it, so passing 0 does not save the sender
    // anything — it strands the ALGO in the router account and the
    // receiver is told they have insufficient ALGO to claim.
    const additionalReceiverFunds = BigInt(summary.algo_fund_amount)

    // The forwarding payment is an inner txn the router does not
    // report in inner_tx_count, so its fee has to be pooled on top.
    const innerTxCount =
        BigInt(summary.inner_tx_count) +
        (additionalReceiverFunds > 0n ? 1n : 0n)

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
                additionalReceiverFunds,
            ],
            ...(senderFee > minFee
                ? {
                      staticFee: (
                          senderFee +
                          minFee * innerTxCount
                      ).microAlgo(),
                  }
                : {
                      extraFee: (minFee * innerTxCount).microAlgo(),
                  }),
            ...sendAssetRefs,
        }),
    )

    return buildGroup(composer)
}
