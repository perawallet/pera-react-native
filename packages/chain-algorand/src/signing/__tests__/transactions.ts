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
    i18nKey,
    type PeraTransaction,
    type SignedTransaction,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { assembleSignedTransaction } from '../local-key/signTransactionsWithLocalKey'
import type { AlgorandTransactionPayload } from '../planner'
import { toSignedAlgorandTransaction } from '../signedTransactions'

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

/** A chain-neutral transaction on Algorand's own scope with no Algorand payload, so every path refuses or skips it. */
export const makeUnsignedAlgorandTransaction = (): UnsignedTransaction => ({
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    payload: {},
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transfer') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'algorand' },
})

export const asUnsignedAlgorandTransaction = (
    transaction: PeraTransaction,
    payload: Omit<AlgorandTransactionPayload, 'transaction'> = {},
): UnsignedTransaction => ({
    ...makeUnsignedAlgorandTransaction(),
    payload: { transaction, ...payload },
})

/** The genesis a chain-neutral payload must carry for the mainnet scope to read it. */
export const MAINNET_GENESIS_HASH = decodeFromBase64(
    'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
)

/** The transaction a wrapped payload carries, read without the network check fixtures on a mocked node would fail. */
export const payloadTransactionOf = (
    unsigned: UnsignedTransaction,
): PeraTransaction =>
    (unsigned.payload as AlgorandTransactionPayload).transaction

/** A signature of the length an Ed25519 envelope encodes, filled with `byte` so slots tell apart. */
export const testSignature = (byte: number): Uint8Array =>
    new Uint8Array(64).fill(byte)

/** `transaction` as a signer returns it: signed by its sender with `sig`, or unsigned without one. */
export const signedAlgorandTransaction = (
    transaction: PeraTransaction,
    sig?: Uint8Array,
): SignedTransaction =>
    toSignedAlgorandTransaction(
        assembleSignedTransaction(
            transaction,
            sig && { sig, signerAddress: transaction.sender.toString() },
        ),
        { chainId: 'algorand', networkId: 'mainnet' },
    )
