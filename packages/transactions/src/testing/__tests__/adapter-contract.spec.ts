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


import type { SendFlowChainAdapter } from '../../chain-adapter'
import { sendFlowContractTests } from '../adapter-contract'

const isQuote = (summary: unknown): boolean =>
    typeof summary === 'object' && summary !== null && 'fee' in summary

const adapter: SendFlowChainAdapter = {
    chainId: 'algorand',
    assetInbox: {
        buildSendTxs: async ({ summary }) => {
            if (!isQuote(summary)) throw new Error('malformed quote')
            return []
        },
        buildClaimTxs: async () => [],
        buildRejectTxs: async () => [],
    },
}

sendFlowContractTests(() => adapter, {
    inboxSend: {
        network: 'testnet',
        sender: 'SENDER',
        receiver: 'RECEIVER',
        assetId: 1n,
        amount: 1n,
        summary: { fee: 1 },
        senderMinFee: 1000n,
    },
})
sendFlowContractTests(() => ({ chainId: 'algorand' }), {})
