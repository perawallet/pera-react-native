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
import { toAssetInboxQuote } from '@perawallet/wallet-core-transactions'
import { sendFlowContractTests } from '@perawallet/wallet-core-transactions/testing'

// Builders stubbed to succeed with a real mainnet transaction, so a rejection
// can only come from the adapter's own validation of the quote.
const { payment } = vi.hoisted(() => ({
    payment: async () => {
        const { MAINNET_GENESIS_HASH, makeTestAddress, makeTestPaymentTx } =
            await import('../../signing/__tests__/transactions')
        return [
            makeTestPaymentTx(makeTestAddress(1), {
                receiver: makeTestAddress(2),
                genesisHash: MAINNET_GENESIS_HASH,
            }),
        ]
    },
}))

vi.mock('../../blockchain', async importOriginal => ({
    ...(await importOriginal<typeof import('../../blockchain')>()),
    createWalletAlgorandClient: vi.fn(() => ({})),
}))
vi.mock('../builders', () => ({
    buildArc59SendViaInboxTxs: vi.fn(payment),
    buildArc59ClaimTxs: vi.fn(payment),
    buildArc59RejectTxs: vi.fn(payment),
}))
vi.mock('../../transactions/builders', () => ({
    buildTransferTxs: vi.fn(payment),
    buildExpressTransferTxs: vi.fn(payment),
    buildOptInTxs: vi.fn(payment),
    buildOptOutTxs: vi.fn(payment),
    buildRekeyTx: vi.fn(async () => (await payment())[0]),
}))

import { algorandSendFlowAdapter } from '../../transactions'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const claim = {
    scope,
    sender: 'SENDER',
    assetId: 31566704n,
    shouldClaimAlgo: true,
    inboxAddress: 'INBOX',
    senderMinFee: 1000n,
}

sendFlowContractTests(() => algorandSendFlowAdapter, {
    inboxSend: {
        scope,
        sender: 'SENDER',
        receiver: 'RECEIVER',
        assetId: 31566704n,
        amount: 1n,
        quote: toAssetInboxQuote({}),
        senderMinFee: 1000n,
    },
    inboxSendQuote: toAssetInboxQuote({
        is_arc59_opted_in: true,
        minimum_balance_requirement: 100000,
        inner_tx_count: 2,
        total_protocol_and_mbr_fee: 4000,
        inbox_address: null,
        algo_fund_amount: 0,
        warning_message: null,
    }),
    inboxClaim: claim,
    inboxReject: { ...claim, assetCreator: 'CREATOR' },
    transfer: {
        scope,
        sender: 'SENDER',
        receiver: 'RECEIVER',
        assetId: '0',
        amount: 1n,
    },
    express: {
        scope,
        sender: 'SENDER',
        receiver: 'RECEIVER',
        assetId: 31566704n,
        amount: 1n,
        funding: 0n,
    },
    optIn: { scope, sender: 'SENDER', assetId: 31566704n },
    optOut: {
        scope,
        optOuts: [{ sender: 'SENDER', assetId: 31566704n, creator: 'CREATOR' }],
    },
    delegation: {
        scope,
        sourceAddress: 'SENDER',
        authorityAddress: 'AUTH',
        minFee: 1000n,
    },
})
