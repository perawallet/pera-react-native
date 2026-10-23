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

import { Address, Transaction, TransactionType } from 'algosdk'
import {
    transactionPlanners,
    type ChainScope,
    type SigningRequest,
    type TransactionPlanner,
    type UnsignedTransaction,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'

// Shared fixture for specs that must exercise genuine algosdk Transactions:
// hand-built literals with SDK-shaped fields are exactly what let
// ship as dead code, because v3 keeps type-specific fields (receiver, amount,
// closeRemainderTo, ...) under `payment`/`assetTransfer`, not at the top level.
export const TEST_SUGGESTED_PARAMS = {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

export const makeTestAddress = (fill: number): Address =>
    new Address(new Uint8Array(32).fill(fill))

type TestPaymentParams = {
    receiver: Address
    amount?: bigint
    closeRemainderTo?: Address
    rekeyTo?: Address
    note?: Uint8Array
    /** Overrides TEST_SUGGESTED_PARAMS' genesisHash — for specs that vary chain identity. */
    genesisHash?: Uint8Array
}

export const makeTestPaymentTx = (
    sender: Address,
    { rekeyTo, note, genesisHash, ...paymentParams }: TestPaymentParams,
): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender,
        rekeyTo,
        note,
        paymentParams: { amount: 0n, ...paymentParams },
        suggestedParams: genesisHash
            ? { ...TEST_SUGGESTED_PARAMS, genesisHash }
            : TEST_SUGGESTED_PARAMS,
    })

type TestAssetTransferParams = {
    assetIndex: bigint
    receiver: Address
    amount?: bigint
    closeRemainderTo?: Address
}

export const makeTestAssetTransferTx = (
    sender: Address,
    assetTransferParams: TestAssetTransferParams,
): Transaction =>
    new Transaction({
        type: TransactionType.axfer,
        sender,
        assetTransferParams: { amount: 0n, ...assetTransferParams },
        suggestedParams: TEST_SUGGESTED_PARAMS,
    })

export const asUnsignedAlgorandTransaction = (
    transaction: Transaction,
    payload: { authorizer?: string } = {},
    scope: ChainScope = { chainId: 'algorand', networkId: 'mainnet' },
): UnsignedTransaction => ({
    scope,
    payload: { transaction, ...payload },
    summary: {
        kind: 'transfer',
        title: { key: 'transfer' },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'algorand' },
})

export const SECOND_CHAIN_SCOPE: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}

/** A chain-neutral transaction; {@link planFromPayload} reads its signer back. */
export const makeUnsignedTransaction = (
    from: string,
    scope: ChainScope = SECOND_CHAIN_SCOPE,
): UnsignedTransaction => ({
    scope,
    payload: { from },
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transfer') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

/**
 * Names the payload's `from` as the one signer, as a single-signature chain
 * plans, in the scheme of the Algorand rules the second chain runs on.
 */
export const planFromPayload = (
    transaction: UnsignedTransaction,
): SigningRequest[] => {
    // As every planner must, it refuses another chain's transaction.
    if (transaction.scope.chainId !== SECOND_CHAIN_SCOPE.chainId) {
        throw new Error(`Not a ${SECOND_CHAIN_SCOPE.chainId} transaction`)
    }
    const { from } = transaction.payload as { from: string }
    return [
        {
            requestIndex: 0,
            signer: from,
            scheme: 'ed25519',
            // Copied into this realm: jsdom's TextEncoder returns a foreign Uint8Array.
            payload: new Uint8Array(new TextEncoder().encode(from)),
            devicePayload: new Uint8Array(
                new TextEncoder().encode(`device:${from}`),
            ),
        },
    ]
}

/** Plans with `plan` and assembles by concatenating the signatures. */
export const fakeTransactionPlanner = (
    plan: TransactionPlanner['plan'] = planFromPayload,
): TransactionPlanner => ({
    chainId: SECOND_CHAIN_SCOPE.chainId,
    plan,
    assemble: (transaction, signatures) => ({
        scope: transaction.scope,
        id: `signed-by-${signatures.map(s => s.signer).join(',')}`,
        bytes: new Uint8Array(signatures.flatMap(s => [...s.bytes])),
    }),
})

/**
 * Plans an Algorand payload's one signer, its authorizer or else its sender,
 * as Algorand's planner does a single-signature transaction.
 */
export const fakeAlgorandTransactionPlanner = (): TransactionPlanner => ({
    chainId: 'algorand',
    plan: unsigned => {
        if (unsigned.chainData.family !== 'algorand') {
            throw new Error('Not an Algorand transaction')
        }
        const { transaction, authorizer } = unsigned.payload as {
            transaction: Transaction
            authorizer?: string
        }
        return [
            {
                requestIndex: 0,
                signer: authorizer ?? transaction.sender.toString(),
                scheme: 'ed25519',
                payload: transaction.bytesToSign(),
                // `bytesToSign` without its `TX` signing-domain prefix.
                devicePayload: transaction.bytesToSign().slice(2),
            },
        ]
    },
    assemble: (unsigned, signatures) => ({
        scope: unsigned.scope,
        id: (
            unsigned.payload as { transaction: Transaction }
        ).transaction.txID(),
        bytes: new Uint8Array(signatures.flatMap(s => [...s.bytes])),
    }),
})

export const registerFakeTransactionPlanner = (
    planner: TransactionPlanner = fakeTransactionPlanner(),
): TransactionPlanner => {
    transactionPlanners.reset()
    transactionPlanners.register(planner)
    return planner
}
