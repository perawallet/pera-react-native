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

import { createWalletAlgorandClient } from '../blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import type { AssetInboxSendFlow } from '@perawallet/wallet-core-transactions'
import { algorandNetworkOf } from '../legacy-network'
import {
    fetchArc59AssetRequests,
    fetchArc59SendSummary,
    arc59SendSummaryResponseSchema,
} from './api'
import { getArc59SignedFundingAmount } from './getArc59SignedFundingAmount'
import {
    buildArc59ClaimTxs,
    buildArc59RejectTxs,
    buildArc59SendViaInboxTxs,
} from './builders'

type InboxBuilder = 'buildSendTxs' | 'buildClaimTxs' | 'buildRejectTxs'

/** The send-flow adapter wraps the builders into chain-neutral transactions. */
type AlgorandAssetInbox = Omit<AssetInboxSendFlow, InboxBuilder> & {
    [Builder in InboxBuilder]: (
        params: Parameters<AssetInboxSendFlow[Builder]>[0],
    ) => Promise<PeraTransaction[]>
}

// Built per call so a custom-network edit is picked up, as useAlgorandClient's
// memo does.
export const algorandAssetInbox: AlgorandAssetInbox = {
    fetchRequests: ({ scope, address }) =>
        fetchArc59AssetRequests(algorandNetworkOf(scope), address),
    fetchSendSummary: async ({ scope, receiver, assetId }) => {
        const quote = await fetchArc59SendSummary(
            algorandNetworkOf(scope),
            receiver,
            assetId,
        )
        return { quote, fundingAmount: getArc59SignedFundingAmount(quote) }
    },
    buildSendTxs: async ({ scope, summary, ...params }) => {
        const network = algorandNetworkOf(scope)
        return buildArc59SendViaInboxTxs(
            { algokit: createWalletAlgorandClient(network), network },
            {
                ...params,
                // Re-validated here because the send flow carries the
                // summary opaquely and it decides a headlessly signed payment.
                summary: arc59SendSummaryResponseSchema.parse(summary),
            },
        )
    },
    buildClaimTxs: ({ scope, ...params }) => {
        const network = algorandNetworkOf(scope)
        return buildArc59ClaimTxs(
            { algokit: createWalletAlgorandClient(network), network },
            params,
        )
    },
    buildRejectTxs: ({ scope, ...params }) => {
        const network = algorandNetworkOf(scope)
        return buildArc59RejectTxs(
            { algokit: createWalletAlgorandClient(network), network },
            params,
        )
    },
}
