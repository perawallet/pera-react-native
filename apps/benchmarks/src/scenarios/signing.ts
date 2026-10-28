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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    Address,
    Transaction,
    TransactionType,
    groupTransactions,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { toUnsignedAlgorandTransactions } from '@perawallet/wallet-core-chain-algorand/signing'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { benchScope } from '../data/scope'
import type { Scenario, ScenarioContext } from '../runner/types'
import { discardAccountKeys } from './keys'

const GENESIS_HASH = Uint8Array.from(
    atob('wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='),
    char => char.charCodeAt(0),
)
const GROUP_SIZE = 16
const DIGEST_BYTES = 32

type SigningState = {
    ctx: ScenarioContext
    account: WalletAccount
    transactions: UnsignedTransaction[]
}

/** Self-payments in one group, so each signature is over a real transaction. */
const paymentGroup = (
    account: WalletAccount,
    count: number,
): UnsignedTransaction[] => {
    const sender = account.chains.algorand?.address
    if (!sender) throw new Error('The minted account has no Algorand address')
    const address = Address.fromString(sender)
    const transactions = Array.from(
        { length: count },
        () =>
            new Transaction({
                type: TransactionType.pay,
                sender: address,
                paymentParams: { receiver: address, amount: 1000n },
                suggestedParams: {
                    fee: 1000n,
                    flatFee: true,
                    minFee: 1000n,
                    firstValid: 1000n,
                    lastValid: 2000n,
                    genesisID: 'mainnet-v1.0',
                    genesisHash: GENESIS_HASH,
                },
            }),
    )
    return toUnsignedAlgorandTransactions(
        count > 1 ? groupTransactions(transactions) : transactions,
        benchScope(),
    )
}

const signsOnAlgorand = (
    id: string,
    title: string,
    count: number,
    mint: (ctx: ScenarioContext) => Promise<WalletAccount>,
): Scenario<SigningState> => ({
    id,
    group: 'signing',
    title,
    scales: ['S'],
    setup: async ctx => {
        const account = await mint(ctx)
        return { ctx, account, transactions: paymentGroup(account, count) }
    },
    run: async ({ ctx, account, transactions }) => {
        const signed = await ctx.signTransactions(
            transactions,
            transactions.map((_, index) => index),
            account,
            benchScope(),
        )
        if (signed.length !== count) {
            throw new Error(`Signed ${signed.length} of ${count} transactions`)
        }
    },
    teardown: ({ account }) => discardAccountKeys([account]),
})

const mintHd = (ctx: ScenarioContext) =>
    ctx.createHdWalletAccount({ account: 0, keyIndex: 0 })

const mintQuantum = (ctx: ScenarioContext) =>
    ctx.createSingleKeyAccount({ seed: 'quantum' })

type DigestState = { account: WalletAccount; keyPairId: string }

// Ethereum transactions sign through the chain's planner, which needs a
// chain-side request; what is timed here is the KMS secp256k1 signature that
// path ends in, over a 32-byte digest.
const ethereumDigest: Scenario<DigestState> = {
    id: 'signing.ethereum-1',
    group: 'signing',
    title: 'One secp256k1 signature on an Ethereum key',
    scales: ['S'],
    requiresChain: 'ethereum',
    setup: async ctx => {
        const account = await mintHd(ctx)
        const keyPairId = account.chains.ethereum?.keyPairId
        if (!keyPairId) {
            throw new Error('Needs a build that enables the ethereum chain')
        }
        return { account, keyPairId }
    },
    run: async ({ keyPairId }) => {
        const digest = Uint8Array.from(
            { length: DIGEST_BYTES },
            (_, i) => i + 1,
        )
        await kmsCore.sign(keyPairId, digest, SIGNING_ACCESS_DOMAIN)
    },
    teardown: ({ account }) => discardAccountKeys([account]),
}

export const signingScenarios: Scenario[] = [
    signsOnAlgorand(
        'signing.algorand-1',
        'Sign one Algorand payment',
        1,
        mintHd,
    ) as Scenario,
    signsOnAlgorand(
        'signing.algorand-16',
        `Sign a group of ${GROUP_SIZE} Algorand payments`,
        GROUP_SIZE,
        mintHd,
    ) as Scenario,
    ethereumDigest as Scenario,
    signsOnAlgorand(
        'signing.falcon-1',
        'Sign one payment with a Falcon key',
        1,
        mintQuantum,
    ) as Scenario,
]
