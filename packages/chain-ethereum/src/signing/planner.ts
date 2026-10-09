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
    getAddress,
    hexToBytes,
    isAddress,
    keccak256,
    serializeTransaction,
} from 'viem'
import type { Address, TransactionSerializableEIP1559 } from 'viem'
import type {
    Signature,
    SignedTransaction,
    SigningRequest,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { eip155ChainIdOf, ethereumAddressCodec } from '../addresses'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { transactionDigest } from './digests'
import { toViemSignature } from './sign'

/** The `UnsignedTransaction.payload` for scope chain `'ethereum'`. */
export type EthereumTransactionPayload = {
    /** The sender, which an EIP-1559 transaction does not carry. */
    from: Address
    /** Value and fees in wei, gas in gas units. */
    transaction: TransactionSerializableEIP1559
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

// `payload` is `unknown` and may come from a dApp, so this is the trust boundary
// for both `plan` and `assemble`.
const readEthereumTransaction = (
    unsigned: UnsignedTransaction,
): EthereumTransactionPayload => {
    const { scope, chainData, payload } = unsigned
    if (scope.chainId !== ETHEREUM_CHAIN_ID || chainData.family !== 'evm') {
        throw new Error(
            `Not an Ethereum transaction: ${scope.chainId}/${chainData.family}`,
        )
    }
    if (
        !isRecord(payload) ||
        typeof payload.from !== 'string' ||
        !isAddress(payload.from) ||
        !isRecord(payload.transaction) ||
        (payload.transaction.type !== undefined &&
            payload.transaction.type !== 'eip1559')
    ) {
        throw new Error('The Ethereum transaction payload is malformed')
    }
    const transaction = payload.transaction as TransactionSerializableEIP1559
    // A transaction for another EIP-155 chain would be replayable there.
    if (transaction.chainId !== eip155ChainIdOf(scope.networkId)) {
        throw new Error(
            `The transaction is for EIP-155 chain ${transaction.chainId}, not ${scope.networkId}`,
        )
    }
    return { from: getAddress(payload.from), transaction }
}

export const ethereumPlannerAdapter = {
    chainId: ETHEREUM_CHAIN_ID,

    plan: (unsigned: UnsignedTransaction): SigningRequest[] => {
        const { from, transaction } = readEthereumTransaction(unsigned)
        return [
            {
                requestIndex: 0,
                signer: from,
                scheme: 'secp256k1',
                payload: transactionDigest(transaction).digest,
            },
        ]
    },

    assemble: (
        unsigned: UnsignedTransaction,
        signatures: Signature[],
    ): SignedTransaction => {
        const { from, transaction } = readEthereumTransaction(unsigned)
        const [signature] = signatures
        if (
            signatures.length !== 1 ||
            signature.requestIndex !== 0 ||
            signature.scheme !== 'secp256k1' ||
            !ethereumAddressCodec.areEqual(signature.signer, from)
        ) {
            throw new Error(
                'An Ethereum transaction takes exactly one secp256k1 signature, from its sender',
            )
        }
        const serialized = serializeTransaction(
            { ...transaction, type: 'eip1559' },
            toViemSignature(signature.bytes, 'eip155-tx'),
        )
        return {
            scope: unsigned.scope,
            id: keccak256(serialized),
            bytes: hexToBytes(serialized),
        }
    },
}
