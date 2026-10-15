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

import { transactionPlannerContractTests } from './transaction-planner-contract'
import {
    FIXTURE_CHAIN_ID,
    fixturePlanner,
    type FixturePayload,
} from './fixture-chain'
import type { UnsignedTransaction } from '../models/domain'
import { i18nKey } from '../models/i18n'

const SIGNER = `fx${'ab'.repeat(20)}`

const fixtureTransaction = (payload: unknown): UnsignedTransaction => ({
    scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'mainnet' },
    payload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

transactionPlannerContractTests(() => fixturePlanner, {
    transaction: fixtureTransaction({
        signer: SIGNER,
        body: 'pay 5',
    } satisfies FixturePayload),
    otherTransaction: fixtureTransaction({
        signer: SIGNER,
        body: 'pay 6',
    } satisfies FixturePayload),
    malformedTransaction: fixtureTransaction({ signer: SIGNER }),
    sign: async request => request.payload.map(byte => byte ^ 0xff),
    stranger: `fx${'cd'.repeat(20)}`,
})
