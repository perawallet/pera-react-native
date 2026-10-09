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

import {
    OnApplicationComplete,
    Transaction,
    TransactionType,
    type Address,
} from 'algosdk'
import { algo25Account } from '../../__tests__/algorandAccounts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { SignableGroup } from '@perawallet/wallet-core-signing'
import { reviewerContractTests } from '@perawallet/wallet-core-signing/testing'
import { algorandReviewerAdapter } from '../adapter'
import {
    TEST_SUGGESTED_PARAMS,
    makeTestAddress,
    makeTestPaymentTx,
} from './transactions'

const WALLET = makeTestAddress(1)
const OTHER = makeTestAddress(2)
// Real mainnet transactions, so the decoder's genesis check runs unmocked.
const MAINNET_GENESIS = decodeFromBase64(
    getNetworkConfig('mainnet').genesisHash,
)

const REKEY_TARGET = makeTestAddress(5)

const payment = (
    sender: Address,
    {
        rekeyTo,
        genesisHash = MAINNET_GENESIS,
    }: { rekeyTo?: Address; genesisHash?: Uint8Array } = {},
): Transaction =>
    makeTestPaymentTx(sender, {
        receiver: OTHER,
        amount: 1n,
        rekeyTo,
        genesisHash,
    })

// An app call's effect lives in its program, which review can't read.
const appCall = new Transaction({
    type: TransactionType.appl,
    sender: WALLET,
    appCallParams: { appIndex: 99n, onComplete: OnApplicationComplete.NoOpOC },
    suggestedParams: { ...TEST_SUGGESTED_PARAMS, genesisHash: MAINNET_GENESIS },
})

const groupOf = (signer: Address, transactions: Transaction[]): SignableGroup =>
    ({
        signerAddress: signer.toString(),
        source: { type: 'local' },
        data: {
            type: 'transactions',
            transactions,
            indicesToSign: transactions.map((_, i) => i),
        },
    }) as unknown as SignableGroup

reviewerContractTests(() => algorandReviewerAdapter, {
    context: {
        scope: scopeForLegacyNetwork('mainnet'),
        accounts: [algo25Account(WALLET.toString())],
    },
    plainGroup: groupOf(WALLET, [payment(WALLET)]),
    riskyGroup: groupOf(WALLET, [payment(WALLET, { rekeyTo: REKEY_TARGET })]),
    foreignGroup: groupOf(OTHER, [payment(OTHER, { rekeyTo: REKEY_TARGET })]),
    opaqueGroup: groupOf(WALLET, [appCall]),
    wrongNetworkGroup: groupOf(WALLET, [
        payment(WALLET, { genesisHash: TEST_SUGGESTED_PARAMS.genesisHash }),
    ]),
    messageGroup: {
        signerAddress: WALLET.toString(),
        source: { type: 'local' },
        data: { type: 'arbitrary-data', data: [] },
    } as unknown as SignableGroup,
})
