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

import { toAssetInboxQuote, type SendFlowChainAdapter } from '../chain-adapter'
import { sendFlowContractTests } from './adapter-contract'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const isQuote = (quote: object): boolean => 'fee' in quote

const adapter: SendFlowChainAdapter = {
    chainId: 'algorand',
    buildTransferTxs: async () => [],
    transactionFee: vi.fn(),
    assetInbox: {
        buildSendTxs: async ({ quote }) => {
            if (!isQuote(quote)) throw new Error('malformed quote')
            return []
        },
        buildClaimTxs: async () => [],
        buildRejectTxs: async () => [],
    },
}

describe('an adapter with an asset inbox', () => {
    sendFlowContractTests(() => adapter, {
        inboxSend: {
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            sender: 'SENDER',
            receiver: 'RECEIVER',
            assetId: 1n,
            amount: 1n,
            quote: toAssetInboxQuote({ fee: 1 }),
            senderMinFee: 1000n,
        },
    })
})

describe('a transfer-only adapter', () => {
    sendFlowContractTests(
        () => ({ chainId: 'algorand', buildTransferTxs: async () => [] }),
        {},
    )
})
