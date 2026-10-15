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

import { beforeEach, describe, expect, it } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import nacl from 'tweetnacl'
import { Address, Transaction, TransactionType } from 'algosdk'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    PeraTransaction,
    Signature,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type {
    LocalKeySigningDeps,
    SigningResult,
} from '@perawallet/wallet-core-signing'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { standaloneAccount } from '../../__tests__/algorandAccounts'
import { groupTransactions } from '../../blockchain'
import { encodeSignedTransaction } from '../../blockchain/utils/transact'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { signTransactionsWithLocalKey } from '../local-key/signTransactionsWithLocalKey'
import { mergeSigningResults } from '../mergeSigningResults'
import { algorandTransactionPlanner } from '../planner'
import {
    toAlgorandUnsignedTransactions,
    withDeclaredSigner,
} from '../unsignedAlgorandTransactions'
import {
    MAINNET_GENESIS_HASH,
    TEST_SUGGESTED_PARAMS,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from './transactions'

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const
const PARAMS = { ...TEST_SUGGESTED_PARAMS, genesisHash: MAINNET_GENESIS_HASH }

const keyPairOf = (byte: number) =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))
const ALICE = keyPairOf(1)
const BOB = keyPairOf(2)
const SPONSOR = keyPairOf(9)
const addressOf = (keys: nacl.SignKeyPair) => new Address(keys.publicKey)
const KEYS: Record<string, nacl.SignKeyPair> = {
    'key-alice': ALICE,
    'key-bob': BOB,
}
const KEY_OF_ADDRESS: Record<string, string> = {
    [addressOf(ALICE).toString()]: 'key-alice',
    [addressOf(BOB).toString()]: 'key-bob',
}

const alice = standaloneAccount(addressOf(ALICE).toString(), {
    keyPairId: 'key-alice',
})
const bob = standaloneAccount(addressOf(BOB).toString(), {
    keyPairId: 'key-bob',
})
const ACCOUNTS = [alice, bob]

const deps: LocalKeySigningDeps = {
    signPayloads: async (keyPairId, payloads) =>
        payloads.map(payload =>
            nacl.sign.detached(payload, KEYS[keyPairId].secretKey),
        ),
    getPQSigningInfo: () => null,
    yieldBetweenBatches: async () => undefined,
}

const pay = (from: nacl.SignKeyPair, to: nacl.SignKeyPair, amount: bigint) =>
    makeTestPaymentTx(addressOf(from), {
        receiver: addressOf(to),
        amount,
        genesisHash: MAINNET_GENESIS_HASH,
    })

const assetTransfer = (
    from: nacl.SignKeyPair,
    to: nacl.SignKeyPair,
    amount: bigint,
    closeTo?: nacl.SignKeyPair,
) =>
    new Transaction({
        type: TransactionType.axfer,
        sender: addressOf(from),
        assetTransferParams: {
            assetIndex: 31566704n,
            receiver: addressOf(to),
            amount,
            closeRemainderTo: closeTo && addressOf(closeTo),
        },
        suggestedParams: PARAMS,
    })

const appCall = (from: nacl.SignKeyPair) =>
    new Transaction({
        type: TransactionType.appl,
        sender: addressOf(from),
        appCallParams: { appIndex: 643020148n, onComplete: 0 },
        suggestedParams: PARAMS,
    })

const keyRegistrationOffline = (from: nacl.SignKeyPair) =>
    new Transaction({
        type: TransactionType.keyreg,
        sender: addressOf(from),
        keyregParams: {},
        suggestedParams: PARAMS,
    })

const signThroughPlanner = async (
    wrapped: UnsignedTransaction[],
    indicesToSign: number[],
): Promise<Uint8Array[]> => {
    const signed = []
    for (const index of indicesToSign) {
        const transaction = wrapped[index]
        const signatures: Signature[] = algorandTransactionPlanner
            .plan(transaction)
            .map(request => ({
                requestIndex: request.requestIndex,
                signer: request.signer,
                scheme: request.scheme,
                bytes: nacl.sign.detached(
                    request.payload,
                    KEYS[KEY_OF_ADDRESS[request.signer]].secretKey,
                ),
            }))
        signed.push(
            await algorandTransactionPlanner.assemble(transaction, signatures),
        )
    }
    const planned: SigningResult = {
        signedData: { type: 'signed-transactions', signed, historyEntries: [] },
        signers: [],
        originalIndices: indicesToSign,
    }
    const delivered = mergeSigningResults([planned])
    if (delivered.signedData.type !== 'transactions') {
        throw new Error(`delivered as ${delivered.signedData.type}`)
    }
    return delivered.signedData.signed.map(encodeSignedTransaction)
}

// Unsigned slots come back as bare envelopes; only the signed ones are delivered.
const signedToday = async (
    group: PeraTransaction[],
    indicesToSign: number[],
    signer: WalletAccount,
): Promise<Uint8Array[]> => {
    const signed = await signTransactionsWithLocalKey(
        deps,
        group,
        indicesToSign,
        signer,
    )
    return indicesToSign.map(index => encodeSignedTransaction(signed[index]))
}

type SourceFixture = {
    group: () => PeraTransaction[]
    indicesToSign: number[]
    signer: WalletAccount
    /** ARC-0001 `signers`, keyed by position in `indicesToSign`. */
    declaredSigners?: Map<number, string>
    arrange?: () => void
}

const SOURCES: Record<string, SourceFixture> = {
    'in-app send': {
        group: () => [pay(ALICE, BOB, 1_000_000n)],
        indicesToSign: [0],
        signer: alice,
    },
    'express send (funding and transfer legs)': {
        group: () =>
            groupTransactions([
                pay(ALICE, BOB, 201_000n),
                assetTransfer(BOB, BOB, 0n),
                assetTransfer(ALICE, BOB, 5n),
            ]),
        indicesToSign: [0, 2],
        signer: alice,
    },
    'asset opt-in': {
        group: () => [assetTransfer(ALICE, ALICE, 0n)],
        indicesToSign: [0],
        signer: alice,
    },
    'asset opt-out': {
        group: () => [assetTransfer(ALICE, ALICE, 0n, BOB)],
        indicesToSign: [0],
        signer: alice,
    },
    rekey: {
        group: () => [
            makeTestPaymentTx(addressOf(ALICE), {
                receiver: addressOf(ALICE),
                rekeyTo: addressOf(BOB),
                genesisHash: MAINNET_GENESIS_HASH,
            }),
        ],
        indicesToSign: [0],
        signer: alice,
    },
    'key registration (in-app and deeplink)': {
        group: () => [keyRegistrationOffline(ALICE)],
        indicesToSign: [0],
        signer: alice,
    },
    'asset inbox send': {
        group: () =>
            groupTransactions([pay(ALICE, BOB, 100_000n), appCall(ALICE)]),
        indicesToSign: [0, 1],
        signer: alice,
    },
    'swap (backend group with a pre-signed slot)': {
        group: () =>
            groupTransactions([
                pay(SPONSOR, ALICE, 1n),
                appCall(ALICE),
                assetTransfer(ALICE, BOB, 7n),
            ]),
        indicesToSign: [1, 2],
        signer: alice,
    },
    'card escrow withdrawal': {
        group: () => groupTransactions([appCall(ALICE)]),
        indicesToSign: [0],
        signer: alice,
    },
    'fee delegation (sponsor re-grouped)': {
        group: () =>
            groupTransactions([pay(SPONSOR, ALICE, 0n), appCall(ALICE)]),
        indicesToSign: [1],
        signer: alice,
    },
    'WalletConnect and in-app browser dApp group': {
        group: () =>
            groupTransactions([
                pay(BOB, ALICE, 1n),
                pay(ALICE, BOB, 2n),
                pay(ALICE, BOB, 3n),
            ]),
        indicesToSign: [1, 2],
        signer: alice,
    },
    'dApp group naming a rekeyed sender’s authority': {
        group: () => [pay(BOB, ALICE, 4n)],
        indicesToSign: [0],
        signer: alice,
        declaredSigners: new Map([[0, addressOf(ALICE).toString()]]),
        arrange: () =>
            seedAuthority(
                addressOf(BOB).toString(),
                addressOf(ALICE).toString(),
                SCOPE,
            ),
    },
    'Bidali gift-card payment': {
        group: () => [assetTransfer(ALICE, BOB, 25_000_000n)],
        indicesToSign: [0],
        signer: alice,
    },
}

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

describe('every local ed25519 source signs to the same bytes through the planner', () => {
    it.each(Object.entries(SOURCES))(
        '%s',
        async (
            _source,
            { group, indicesToSign, signer, declaredSigners, arrange },
        ) => {
            arrange?.()
            const transactions = group()
            const wrapped = toAlgorandUnsignedTransactions(transactions, {
                scope: SCOPE,
                accounts: ACCOUNTS,
            }).map((unsigned, index) => {
                const declared = declaredSigners?.get(
                    indicesToSign.indexOf(index),
                )
                return declared
                    ? withDeclaredSigner(unsigned, declared)
                    : unsigned
            })

            const viaPlanner = await signThroughPlanner(wrapped, indicesToSign)

            expect(viaPlanner).toEqual(
                await signedToday(transactions, indicesToSign, signer),
            )
        },
    )
})
