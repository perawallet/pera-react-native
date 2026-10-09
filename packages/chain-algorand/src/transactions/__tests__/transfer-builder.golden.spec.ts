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

// @vitest-environment node
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { generateAccount } from 'algosdk'
import { setupServer } from 'msw/node'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type AssetRef,
    type ChainId,
    type PeraTransaction,
    type TransactionIntent,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { encodeTransactionRaw } from '../../blockchain'
import { assignMinimumFeesToGroup } from '../../signing/assignMinimumFeesToGroup'
import { resolveMinFeeForSender } from '../../signing/minFeeResolver'
import { mockAlgodTransactionParams } from '../../test-handlers'
import { buildOptInTxs, buildTransferTxs } from '../builders'

vi.mock('../../blockchain/fees/getMinimumFeeConfig', () => ({
    getMinimumFeeConfig: () => ({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    }),
}))

import { buildAlgorandTransfer } from '../transfer-builder'

const scope = scopeForLegacyNetwork('testnet')
const SUGGESTED_MIN_FEE = 1000n
const CONFIG = { configMinTxnFee: 1000n, pqMultiplier: 3n }

const ED25519 = generateAccount().addr.toString()
const QUANTUM = generateAccount().addr.toString()
const RECEIVER = generateAccount().addr.toString()
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand' as ChainId, assetId: '31566704' }

const accounts = [
    {
        id: 'a1',
        address: ED25519,
        custody: { kind: 'local', seed: null },
        keyPairId: 'kp-algo25',
    },
    {
        id: 'q1',
        address: QUANTUM,
        custody: { kind: 'local', seed: 'quantum' },
        keyPairId: 'kp-quantum',
    },
] as WalletAccount[]

// The send flow's rule: a fee override only above the node's suggestion.
const todaysTransfer = (
    sender: string,
    assetId: string,
    amount: bigint,
): Promise<PeraTransaction[]> => {
    const fee = resolveMinFeeForSender({
        senderAddress: sender,
        accounts,
        suggestedMinFee: SUGGESTED_MIN_FEE,
        ...CONFIG,
    })
    return buildTransferTxs({
        scope,
        sender,
        receiver: RECEIVER,
        assetId,
        amount,
        note: 'golden',
        fee: fee > SUGGESTED_MIN_FEE ? fee : undefined,
    })
}

// The opt-in mutation's rule: built at base, then the minimum fee assigned.
const todaysOptIn = async (sender: string): Promise<PeraTransaction[]> =>
    assignMinimumFeesToGroup({
        transactions: await buildOptInTxs({
            scope,
            sender,
            assetId: 31566704n,
        }),
        signableIndices: [0],
        accounts,
        suggestedMinFee: SUGGESTED_MIN_FEE,
        ...CONFIG,
    }).transactions

const cases: Array<{
    name: string
    sender: string
    intent: TransactionIntent
    today: () => Promise<PeraTransaction[]>
    fee: bigint
}> = [ED25519, QUANTUM].flatMap(sender => {
    const fee = sender === QUANTUM ? 3000n : 1000n
    const signer = sender === QUANTUM ? 'a quantum' : 'an ed25519'
    return [
        {
            name: `an ALGO payment from ${signer} sender`,
            sender,
            intent: {
                kind: 'transfer' as const,
                from: sender,
                to: RECEIVER,
                assetRef: ALGO,
                amount: new Decimal(1_500_000),
                note: 'golden',
            },
            today: () => todaysTransfer(sender, '0', 1_500_000n),
            fee,
        },
        {
            name: `an asset transfer from ${signer} sender`,
            sender,
            intent: {
                kind: 'transfer' as const,
                from: sender,
                to: RECEIVER,
                assetRef: USDC,
                amount: new Decimal(250),
                note: 'golden',
            },
            today: () => todaysTransfer(sender, '31566704', 250n),
            fee,
        },
        {
            name: `an asset opt-in by ${signer} account`,
            sender,
            intent: {
                kind: 'asset-opt-in' as const,
                account: sender,
                assetRef: USDC,
            },
            today: () => todaysOptIn(sender),
            fee,
        },
    ]
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('buildAlgorandTransfer golden bytes', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        useAccountsStore.setState({ accounts })
        server.use(mockAlgodTransactionParams())
    })

    it.each(cases)(
        'builds $name byte for byte as today',
        async ({ intent, today, fee }) => {
            const built = await buildAlgorandTransfer(intent, { scope })
            const expected = await today()

            expect(built.map(entry => (entry.payload as PeraTransaction).fee)).toEqual(
                expected.map(() => fee),
            )
            expect(
                built.map(entry =>
                    encodeToBase64(
                        encodeTransactionRaw(entry.payload as PeraTransaction),
                    ),
                ),
            ).toEqual(
                expected.map(transaction =>
                    encodeToBase64(encodeTransactionRaw(transaction)),
                ),
            )
        },
    )
})
