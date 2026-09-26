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

import { createWalletAlgorandClient } from '@perawallet/wallet-core-blockchain'
import type { SendFlowChainAdapter } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { arc59SendSummaryResponseSchema } from './api'
import {
    buildArc59ClaimTxs,
    buildArc59RejectTxs,
    buildArc59SendViaInboxTxs,
} from './builders'

// Built per call so a custom-network edit is picked up, as useAlgorandClient's
// memo does.
export const algorandSendFlowAdapter: SendFlowChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    assetInbox: {
        buildSendTxs: async ({ network, summary, ...params }) =>
            buildArc59SendViaInboxTxs(
                { algokit: createWalletAlgorandClient(network), network },
                {
                    ...params,
                    // Re-validated here because the send flow carries the
                    // summary opaquely and it decides a headlessly signed payment.
                    summary: arc59SendSummaryResponseSchema.parse(summary),
                },
            ),
        buildClaimTxs: ({ network, ...params }) =>
            buildArc59ClaimTxs(
                { algokit: createWalletAlgorandClient(network), network },
                params,
            ),
        buildRejectTxs: ({ network, ...params }) =>
            buildArc59RejectTxs(
                { algokit: createWalletAlgorandClient(network), network },
                params,
            ),
    },
}
