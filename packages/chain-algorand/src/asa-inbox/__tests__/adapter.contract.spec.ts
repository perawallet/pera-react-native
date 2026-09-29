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

import { vi } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { sendFlowContractTests } from '@perawallet/wallet-core-transactions/testing'

// Builders stubbed to succeed, so a rejection can only come from the
// adapter's own validation of the quote.
vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-blockchain')
    >()),
    createWalletAlgorandClient: vi.fn(() => ({})),
}))
vi.mock('../builders', () => ({
    buildArc59SendViaInboxTxs: vi.fn(async () => [{}]),
    buildArc59ClaimTxs: vi.fn(async () => [{}]),
    buildArc59RejectTxs: vi.fn(async () => [{}]),
}))

import { algorandSendFlowAdapter } from '../../transactions'

sendFlowContractTests(() => algorandSendFlowAdapter, {
    inboxSend: {
        scope: scopeForLegacyNetwork('testnet'),
        sender: 'SENDER',
        receiver: 'RECEIVER',
        assetId: 31566704n,
        amount: 1n,
        summary: {},
        senderMinFee: 1000n,
    },
})
