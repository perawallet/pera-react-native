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

import { transactionReviewerContractTests } from './transaction-reviewer-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureReviewer,
    type FixturePayload,
} from './fixture-chain'
import { CHAIN_CAPABILITIES } from '../models/capabilities'
import type { ChainCapabilities } from '../models/capabilities'
import type { UnsignedTransaction } from '../models/domain'
import { i18nKey } from '../models/i18n'
import type { NetworkId } from '../models/identity'

const SIGNER = `fx${'ab'.repeat(20)}`
const STRANGER = `fx${'cd'.repeat(20)}`

const NO_CAPABILITIES = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

const fixtureTransaction = (
    payload: FixturePayload,
    networkId: NetworkId = 'mainnet',
): UnsignedTransaction => ({
    scope: { chainId: FIXTURE_CHAIN_ID, networkId },
    payload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

transactionReviewerContractTests(() => fixtureReviewer, {
    context: {
        scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'mainnet' },
        heldAddresses: [SIGNER],
        isWalletBuilt: false,
        capabilities: NO_CAPABILITIES,
    },
    signer: SIGNER,
    plainGroup: [
        fixtureTransaction({ signer: SIGNER, body: 'pay 5' }),
        fixtureTransaction({ signer: SIGNER, body: 'pay 6' }),
    ],
    riskyGroup: [fixtureTransaction({ signer: SIGNER, body: 'call approve' })],
    foreignGroup: [
        fixtureTransaction({ signer: STRANGER, body: 'call approve' }),
    ],
    opaqueGroup: [fixtureTransaction({ signer: SIGNER, body: 'call approve' })],
    opaqueAutoApproves: false,
    wrongNetworkGroup: [
        fixtureTransaction({ signer: SIGNER, body: 'pay 5' }, 'testnet'),
    ],
})
