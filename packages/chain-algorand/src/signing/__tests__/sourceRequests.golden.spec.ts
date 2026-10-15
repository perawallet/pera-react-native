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

import { afterEach, describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import { Address, Transaction, TransactionType } from 'algosdk'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    PeraTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AnalyzedSignableGroup,
    LocalKeySigningDeps,
    SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { groupTransactions } from '../../blockchain'
import {
    decodeTransaction,
    encodeSignedTransaction,
    encodeTransaction,
    encodeTransactionRaw,
} from '../../blockchain/utils/transact'
import { standaloneAccount } from '../../__tests__/algorandAccounts'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { createLocalKeyStrategy } from '../local-key/createLocalKeyStrategy'
import { signTransactionsWithLocalKey } from '../local-key/signTransactionsWithLocalKey'
import { buildDeferredProposeSigningResult } from '../multisig/multisigParticipants'
import { algorandTransactionPlanner } from '../planner'
import {
    algorandSignedTransactionsOf,
    decodeUnsignedAlgorandTransaction,
    toUnsignedAlgorandTransactions,
} from '../unsignedTransaction'
import { MAINNET_GENESIS_HASH, payloadTransactionOf } from './transactions'

// Every source now hands the pipeline its Algorand transactions wrapped in
// `UnsignedTransaction`s. These pin that, for each source's kind of group,
// the wrapped transactions encode and sign to exactly the bytes the source
// produced before: the unsigned bytes it built, and the signed bytes the
// local-key signer gives the same group in its Algorand form.

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

const keyPairOf = (byte: number): nacl.SignKeyPair =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))

const ALICE = keyPairOf(1)
const BOB = keyPairOf(2)
const KEYS: Record<string, nacl.SignKeyPair> = {
    'key-alice': ALICE,
    'key-bob': BOB,
}
const ALICE_ADDRESS = new Address(ALICE.publicKey)
const BOB_ADDRESS = new Address(BOB.publicKey)
const RECEIVER = new Address(new Uint8Array(32).fill(9))
const keysByAddress: Record<string, nacl.SignKeyPair> = {
    [ALICE_ADDRESS.toString()]: ALICE,
    [BOB_ADDRESS.toString()]: BOB,
}

const alice = standaloneAccount(ALICE_ADDRESS.toString(), {
    keyPairId: 'key-alice',
})
const bob = standaloneAccount(BOB_ADDRESS.toString(), { keyPairId: 'key-bob' })

const deps: LocalKeySigningDeps = {
    signPayloads: async (keyPairId, payloads) =>
        payloads.map(payload =>
            nacl.sign.detached(payload, KEYS[keyPairId].secretKey),
        ),
    getPQSigningInfo: () => null,
    yieldBetweenBatches: async () => undefined,
}

const strategy = createLocalKeyStrategy({
    signTransactions: (txnGroup, indexesToSign, account) =>
        signTransactionsWithLocalKey(deps, txnGroup, indexesToSign, account),
    signArbitraryData: async () => [],
    signAuthData: async () => new Uint8Array(),
    scope: SCOPE,
})

const params = {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    genesisHash: MAINNET_GENESIS_HASH,
}

const txn = (
    type: TransactionType,
    sender: Address,
    fields: Record<string, unknown>,
): Transaction =>
    new Transaction({ type, sender, suggestedParams: params, ...fields })

const pay = (sender = ALICE_ADDRESS, amount = 1_000_000n) =>
    txn(TransactionType.pay, sender, {
        paymentParams: { receiver: RECEIVER, amount },
    })
const assetTransfer = (
    sender: Address,
    receiver: Address,
    amount: bigint,
    closeRemainderTo?: Address,
) =>
    txn(TransactionType.axfer, sender, {
        assetTransferParams: {
            assetIndex: 31566704n,
            receiver,
            amount,
            closeRemainderTo,
        },
    })
const appCall = (sender = ALICE_ADDRESS) =>
    txn(TransactionType.appl, sender, {
        appCallParams: {
            appIndex: 643020148n,
            onComplete: 0,
            appArgs: [new Uint8Array([1, 2, 3])],
        },
    })

const analysis = {
    totalFees: 0n,
    warnings: [],
    signableAddresses: [],
    riskLevel: 'low' as const,
}

// The bytes the local-key signer gives the group in its Algorand form, the
// shape every source sent before.
const signedAsBefore = async (
    transactions: PeraTransaction[],
    indicesToSign: number[],
    account: WalletAccount,
    source: SourceMetadata = { type: 'local' },
): Promise<Uint8Array[]> => {
    const group: AnalyzedSignableGroup = {
        data: { type: 'transactions', transactions, indicesToSign },
        source,
        signerAddress: transactions[indicesToSign[0]].sender.toString(),
        originalIndices: indicesToSign,
        analysis,
    }
    const result = await strategy.sign(group, account)
    if (result.signedData.type !== 'transactions') {
        throw new Error(`unexpected ${result.signedData.type}`)
    }
    return result.signedData.signed.map(encodeSignedTransaction)
}

// What the planner signs for an ed25519 local key, as the machine's planned
// signer does, then reads back through the chain's own result reader.
const signedThroughPlanner = async (
    unsigned: UnsignedTransaction[],
): Promise<Uint8Array[]> => {
    const signed = await Promise.all(
        unsigned.map(transaction =>
            algorandTransactionPlanner.assemble(
                transaction,
                algorandTransactionPlanner.plan(transaction).map(request => ({
                    requestIndex: request.requestIndex,
                    signer: request.signer,
                    scheme: request.scheme,
                    bytes: nacl.sign.detached(
                        request.payload,
                        keysByAddress[request.signer].secretKey,
                    ),
                })),
            ),
        ),
    )
    return algorandSignedTransactionsOf(
        {
            signedData: { type: 'signed-transactions', signed },
            signers: [],
        },
        SCOPE,
    ).map(entry => entry!.bytes)
}

const rawOf = (transactions: PeraTransaction[]) =>
    transactions.map(encodeTransactionRaw)

// From the dApp's wire bytes, as the ARC-0001 resolver decodes them.
const fromWire = (transactions: PeraTransaction[]): UnsignedTransaction[] =>
    toUnsignedAlgorandTransactions(
        transactions.map(transaction =>
            decodeTransaction(encodeTransactionRaw(transaction)),
        ),
        SCOPE,
    )

type Case = {
    source: string
    build: () => PeraTransaction[]
    /** How the source wraps what it built; the adapter wrap by default. */
    wrap?: (transactions: PeraTransaction[]) => UnsignedTransaction[]
    account?: WalletAccount
}

const cases: Case[] = [
    { source: 'send', build: () => [pay()] },
    {
        source: 'express send',
        build: () =>
            groupTransactions([
                pay(),
                assetTransfer(BOB_ADDRESS, BOB_ADDRESS, 0n),
                assetTransfer(ALICE_ADDRESS, BOB_ADDRESS, 5n),
            ]),
    },
    {
        source: 'opt-in',
        build: () => [assetTransfer(ALICE_ADDRESS, ALICE_ADDRESS, 0n)],
    },
    {
        source: 'opt-out',
        build: () => [assetTransfer(ALICE_ADDRESS, RECEIVER, 0n, RECEIVER)],
    },
    {
        source: 'rekey',
        build: () => [
            txn(TransactionType.pay, ALICE_ADDRESS, {
                rekeyTo: BOB_ADDRESS,
                paymentParams: { receiver: ALICE_ADDRESS, amount: 0n },
            }),
        ],
    },
    {
        source: 'key registration',
        build: () => [
            txn(TransactionType.keyreg, ALICE_ADDRESS, { keyregParams: {} }),
        ],
    },
    {
        source: 'keyreg deeplink',
        build: () => [
            txn(TransactionType.keyreg, ALICE_ADDRESS, { keyregParams: {} }),
        ],
        // The adapter normalises a key registration through its wire form.
        wrap: transactions =>
            toUnsignedAlgorandTransactions(
                transactions.map(transaction =>
                    decodeTransaction(encodeTransaction(transaction)),
                ),
                SCOPE,
            ),
    },
    {
        source: 'inbox send',
        build: () => groupTransactions([pay(), appCall(), appCall()]),
    },
    {
        source: 'inbox claim',
        build: () => groupTransactions([appCall(), appCall()]),
    },
    {
        source: 'inbox reject',
        build: () => groupTransactions([appCall(), appCall()]),
    },
    {
        source: 'swap',
        build: () =>
            groupTransactions([
                assetTransfer(ALICE_ADDRESS, RECEIVER, 5n),
                appCall(),
            ]),
    },
    {
        source: 'card deposit',
        build: () => [assetTransfer(ALICE_ADDRESS, RECEIVER, 5n)],
    },
    { source: 'card withdrawal', build: () => [appCall()] },
    {
        source: 'card auto-draw',
        build: () => {
            const enable = appCall()
            enable.fee = 0n
            return [enable]
        },
    },
    {
        source: 'fee delegation',
        build: () =>
            groupTransactions([
                pay(BOB_ADDRESS, 0n),
                assetTransfer(ALICE_ADDRESS, ALICE_ADDRESS, 0n),
            ]).slice(1),
    },
    { source: 'WalletConnect', build: () => [pay()], wrap: fromWire },
    {
        source: 'browser bridge',
        build: () => groupTransactions([pay(), appCall()]),
        wrap: fromWire,
    },
    {
        source: 'a rekeyed sender',
        build: () => [pay(BOB_ADDRESS)],
        account: alice,
    },
]

describe('every source signs the same bytes in the chain-neutral shape', () => {
    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
    })

    it.each(cases)('for $source', async ({ build, wrap, account, source }) => {
        useAccountsStore.getState().setAccounts([alice, bob])
        if (source === 'a rekeyed sender') {
            seedAuthority(BOB_ADDRESS.toString(), ALICE_ADDRESS.toString())
        }
        const transactions = build()
        const before = rawOf(transactions)
        // Each slot signed by its own sender's account, as the pipeline
        // groups them, unless the case names the authority that signs.
        const expected = await Promise.all(
            transactions.map(async (transaction, index) => {
                const signer =
                    account ??
                    (transaction.sender.toString() === ALICE_ADDRESS.toString()
                        ? alice
                        : bob)
                const signed = await signedAsBefore(
                    transactions,
                    [index],
                    signer,
                )
                // The signer returns the slots it signed, or the whole
                // group with the others left unsigned.
                return signed.length === transactions.length
                    ? signed[index]
                    : signed[0]
            }),
        )

        const unsigned = (
            wrap ?? (txs => toUnsignedAlgorandTransactions(txs, SCOPE))
        )(transactions)

        expect(rawOf(unsigned.map(payloadTransactionOf))).toEqual(before)
        expect(await signedThroughPlanner(unsigned)).toEqual(expected)
    })

    it('for a multisig cosign, decoded from the sign request it cosigns', async () => {
        const transactions = [pay()]
        const unsigned = transactions.map(transaction =>
            decodeUnsignedAlgorandTransaction(
                encodeTransactionRaw(transaction),
                SCOPE,
            ),
        )
        const source: SourceMetadata = {
            type: 'multisig-cosign',
            signRequestId: 'sign-request-1',
        }
        const expected = await signedAsBefore(transactions, [0], bob, source)

        const result = await strategy.sign(
            {
                data: {
                    type: 'transactions',
                    transactions: unsigned,
                    chainData: { algorand: { indicesToSign: [0] } },
                },
                source,
                signerAddress: ALICE_ADDRESS.toString(),
                originalIndices: [0],
                analysis,
            },
            bob,
        )

        expect(rawOf(unsigned.map(payloadTransactionOf))).toEqual(
            rawOf(transactions),
        )
        expect(
            algorandSignedTransactionsOf(result, SCOPE).map(
                entry => entry!.bytes,
            ),
        ).toEqual(expected)
    })

    it('for a multisig proposal, which carries the unsigned group', () => {
        const transactions = groupTransactions([pay(), pay()])
        const group = (
            data: AnalyzedSignableGroup['data'],
        ): AnalyzedSignableGroup => ({
            data,
            source: { type: 'local' },
            signerAddress: ALICE_ADDRESS.toString(),
            originalIndices: [0, 1],
            analysis,
        })
        const bytesOf = (
            result: ReturnType<typeof buildDeferredProposeSigningResult>,
        ) =>
            algorandSignedTransactionsOf(result, SCOPE).map(
                entry => entry!.bytes,
            )

        const expected = bytesOf(
            buildDeferredProposeSigningResult(
                group({
                    type: 'transactions',
                    transactions,
                    indicesToSign: [0, 1],
                }),
            ),
        )

        expect(
            bytesOf(
                buildDeferredProposeSigningResult(
                    group({
                        type: 'transactions',
                        transactions: toUnsignedAlgorandTransactions(
                            transactions,
                            SCOPE,
                        ),
                        chainData: { algorand: { indicesToSign: [0, 1] } },
                    }),
                ),
            ),
        ).toEqual(expected)
    })
})
