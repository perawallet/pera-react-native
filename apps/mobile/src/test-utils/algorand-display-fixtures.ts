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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
} from '../__integration__/__fixtures__/onboarding'

export type AlgorandDisplayFixtureKind =
    | 'payment'
    | 'asset-transfer'
    | 'asset-config'
    | 'asset-freeze'
    | 'key-registration'
    | 'app-call'
    | 'heartbeat'
    | 'state-proof'
    | 'unknown'

export const ALGORAND_DISPLAY_FIXTURE_KINDS: readonly AlgorandDisplayFixtureKind[] =
    [
        'payment',
        'asset-transfer',
        'asset-config',
        'asset-freeze',
        'key-registration',
        'app-call',
        'heartbeat',
        'state-proof',
        'unknown',
    ]

export const FIXTURE_SENDER = ALGO25_TEST_ADDRESS
export const FIXTURE_RECEIVER = HD_TEST_ADDRESS
export const FIXTURE_TRANSACTION_ID =
    'FIXTURETXIDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
export const FIXTURE_ASSET_ID = 31566704n
export const FIXTURE_APP_ID = 1002541853n
/** microAlgos. */
export const FIXTURE_FEE = 1000n
/** microAlgos. */
export const FIXTURE_PAYMENT_AMOUNT = 2_500_000n

const base = {
    id: FIXTURE_TRANSACTION_ID,
    sender: FIXTURE_SENDER,
    fee: FIXTURE_FEE,
    firstValid: 1000n,
    lastValid: 2000n,
    confirmedRound: 1500n,
    roundTime: 1_700_000_000,
    roundTimeMillis: 1_700_000_000_000,
} satisfies PeraDisplayableTransaction

const payment = (): PeraDisplayableTransaction => ({
    ...base,
    txType: 'pay',
    paymentTransaction: {
        amount: FIXTURE_PAYMENT_AMOUNT,
        receiver: FIXTURE_RECEIVER,
    },
})

const byKind: Record<
    AlgorandDisplayFixtureKind,
    () => PeraDisplayableTransaction
> = {
    payment,
    'asset-transfer': () => ({
        ...base,
        txType: 'axfer',
        assetTransferTransaction: {
            amount: 5_000_000n,
            assetId: FIXTURE_ASSET_ID,
            receiver: FIXTURE_RECEIVER,
        },
    }),
    'asset-config': () => ({
        ...base,
        txType: 'acfg',
        assetConfigTransaction: {
            assetId: FIXTURE_ASSET_ID,
            params: {
                creator: FIXTURE_SENDER,
                decimals: 6,
                total: 1_000_000n,
                manager: FIXTURE_SENDER,
            },
        },
    }),
    'asset-freeze': () => ({
        ...base,
        txType: 'afrz',
        assetFreezeTransaction: {
            address: FIXTURE_RECEIVER,
            assetId: FIXTURE_ASSET_ID,
            newFreezeStatus: true,
        },
    }),
    'key-registration': () => ({
        ...base,
        txType: 'keyreg',
        keyregTransaction: { nonParticipation: false },
    }),
    'app-call': () => ({
        ...base,
        txType: 'appl',
        applicationTransaction: {
            applicationId: FIXTURE_APP_ID,
            onCompletion: 'noop',
        },
        innerTxns: [
            {
                ...payment(),
                id: undefined,
                sender: FIXTURE_RECEIVER,
                paymentTransaction: {
                    amount: 1000n,
                    receiver: FIXTURE_SENDER,
                },
            },
        ],
    }),
    heartbeat: () => ({
        ...base,
        txType: 'hb',
        heartbeatTransaction: {
            hbAddress: FIXTURE_RECEIVER,
            hbKeyDilution: 10_000n,
            hbProof: {},
            hbSeed: new Uint8Array(32),
            hbVoteId: new Uint8Array(32),
        },
    }),
    'state-proof': () => ({
        ...base,
        txType: 'stpf',
        stateProofTransaction: { stateProofType: 0 },
    }),
    unknown: () => ({ ...base, txType: '' }),
}

export const buildAlgorandDisplayFixture = (
    kind: AlgorandDisplayFixtureKind,
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction => ({ ...byKind[kind](), ...overrides })
