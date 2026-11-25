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

import { z } from 'zod'
import { createWalletAlgorandClient } from '../blockchain'
import {
    InvalidSendParamsError,
    toAssetInboxQuote,
    type AssetInboxSendFlow,
} from '@perawallet/wallet-core-transactions'
import { algorandNetworkOf } from '../network-id'
import {
    fetchArc59AssetRequests,
    fetchArc59SendSummary,
    arc59SendSummaryResponseSchema,
} from './api'
import { getArc59SignedFundingAmount } from './getArc59SignedFundingAmount'
import { resolveAlgorandSenderFee } from '../transactions/transfer-fees'
import { toUnsignedAlgorandTransactions } from '../signing/unsignedTransaction'
import {
    buildArc59ClaimTxs,
    buildArc59RejectTxs,
    buildArc59SendViaInboxTxs,
} from './builders'

const sendQuoteSchema = z.object({
    summary: arc59SendSummaryResponseSchema,
    network: z.string(),
    sender: z.string(),
    receiver: z.string(),
    assetId: z.string(),
    amount: z.bigint().nonnegative(),
    networkFee: z.bigint().nonnegative(),
})

// Built per call so a custom-network edit is picked up, as useAlgorandClient's
// memo does.
export const algorandAssetInbox: AssetInboxSendFlow = {
    fetchRequests: ({ scope, address }) =>
        fetchArc59AssetRequests(algorandNetworkOf(scope), address),
    fetchSendSummary: async ({ scope, sender, receiver, assetId, amount }) => {
        const network = algorandNetworkOf(scope)
        const algokit = createWalletAlgorandClient(network)
        const [summary, suggestedParams] = await Promise.all([
            fetchArc59SendSummary(network, receiver, assetId),
            algokit.getSuggestedParams(),
        ])
        const { networkFee } = await buildArc59SendViaInboxTxs(
            { algokit, network },
            {
                sender,
                receiver,
                assetId: BigInt(assetId),
                amount,
                summary,
                senderMinFee: resolveAlgorandSenderFee(
                    sender,
                    BigInt(suggestedParams.minFee),
                ),
            },
        )
        return {
            quote: toAssetInboxQuote(
                Object.freeze({
                    summary: Object.freeze(summary),
                    network,
                    sender,
                    receiver,
                    assetId,
                    amount,
                    networkFee,
                }),
            ),
            fundingAmount: getArc59SignedFundingAmount(summary),
            networkFee,
        }
    },
    buildSendTxs: async ({ scope, quote, ...params }) => {
        const network = algorandNetworkOf(scope)
        const approved = sendQuoteSchema.parse(quote)
        if (
            approved.network !== network ||
            approved.sender !== params.sender ||
            approved.receiver !== params.receiver ||
            approved.assetId !== params.assetId.toString() ||
            approved.amount !== params.amount
        ) {
            throw new InvalidSendParamsError()
        }
        const { transactions } = await buildArc59SendViaInboxTxs(
            { algokit: createWalletAlgorandClient(network), network },
            {
                ...params,
                summary: approved.summary,
                maxFee: approved.networkFee,
            },
        )
        return toUnsignedAlgorandTransactions(transactions, scope)
    },
    buildClaimTxs: async ({ scope, ...params }) => {
        const network = algorandNetworkOf(scope)
        const transactions = await buildArc59ClaimTxs(
            { algokit: createWalletAlgorandClient(network), network },
            params,
        )
        return toUnsignedAlgorandTransactions(transactions, scope)
    },
    buildRejectTxs: async ({ scope, ...params }) => {
        const network = algorandNetworkOf(scope)
        const transactions = await buildArc59RejectTxs(
            { algokit: createWalletAlgorandClient(network), network },
            params,
        )
        return toUnsignedAlgorandTransactions(transactions, scope)
    },
}
