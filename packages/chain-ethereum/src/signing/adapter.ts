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
    recoverTransactionAddress,
    serializeTransaction,
} from 'viem'
import type { Address, TransactionSerializableEIP1559 } from 'viem'
import type {
    Signature,
    SignedTransaction,
    SigningRequest,
    TransactionPlanner,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { transactionDigest } from './digests'
import { toViemSignature } from './sign'

/** The `UnsignedTransaction.payload` on any EVM chain's scope. */
export type EthereumTransactionPayload = {
    /** The sender, which an EIP-1559 transaction does not carry. */
    from: Address
    /** Value and fees in wei, gas in gas units. */
    transaction: TransactionSerializableEIP1559
    /**
     * A batch transaction not yet reached: it carries no nonce, gas or fees
     * and is reviewed only, never signed.
     */
    isPreview?: true
    /**
     * On a preview, in wei: the most per gas the call may be signed at once
     * reached, since its fee can't be quoted on the review.
     */
    maxFeePerGasCeiling?: bigint
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

/**
 * Reads a payload for review, previews included. Anything that signs reads it
 * through {@link readEvmTransaction} instead.
 */
export const readEvmReviewTransaction = (
    unsigned: UnsignedTransaction,
    chain: EvmChain,
): EthereumTransactionPayload => {
    const { scope, chainData, payload } = unsigned
    if (scope.chainId !== chain.row.id || chainData.family !== 'evm') {
        throw new Error(
            `Not a transaction for ${chain.row.displayName}: ${scope.chainId}/${chainData.family}`,
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
        throw new Error('The EVM transaction payload is malformed')
    }
    const transaction = payload.transaction as TransactionSerializableEIP1559
    // A transaction for another EIP-155 chain would be replayable there.
    if (transaction.chainId !== eip155ChainIdOf(scope, chain)) {
        throw new Error(
            `The transaction is for EIP-155 chain ${transaction.chainId}, not ${scope.networkId}`,
        )
    }
    const ceiling = payload.maxFeePerGasCeiling
    if (ceiling !== undefined && typeof ceiling !== 'bigint') {
        throw new Error('The EVM transaction payload is malformed')
    }
    return {
        from: getAddress(payload.from),
        transaction,
        ...(payload.isPreview === true && { isPreview: true }),
        ...(ceiling !== undefined && { maxFeePerGasCeiling: ceiling }),
    }
}

// `payload` is `unknown` and may come from a dApp, so this is the trust boundary
// for both `plan` and `assemble`.
export const readEvmTransaction = (
    unsigned: UnsignedTransaction,
    chain: EvmChain,
): EthereumTransactionPayload => {
    const payload = readEvmReviewTransaction(unsigned, chain)
    if (payload.isPreview) {
        throw new Error('A batch preview is never signed')
    }
    // viem serialises a missing nonce, gas or max fee as 0, which would sign a
    // transaction the user never saw priced. The priority fee deliberately
    // defaults to 0.
    const { nonce, gas, maxFeePerGas } = payload.transaction
    if (
        typeof nonce !== 'number' ||
        typeof gas !== 'bigint' ||
        typeof maxFeePerGas !== 'bigint'
    ) {
        throw new Error(
            'The EVM transaction needs a nonce, a gas limit and a max fee per gas to be signed',
        )
    }
    return payload
}

export const createEvmPlannerAdapter = (
    chain: EvmChain,
): TransactionPlanner => ({
    chainId: chain.row.id,

    plan: (unsigned: UnsignedTransaction): SigningRequest[] => {
        const { from, transaction } = readEvmTransaction(unsigned, chain)
        return [
            {
                requestIndex: 0,
                signer: from,
                scheme: 'secp256k1',
                payload: transactionDigest(transaction).digest,
                devicePayload: hexToBytes(
                    serializeTransaction({ ...transaction, type: 'eip1559' }),
                ),
            },
        ]
    },

    assemble: async (
        unsigned: UnsignedTransaction,
        signatures: Signature[],
    ): Promise<SignedTransaction> => {
        const { from, transaction } = readEvmTransaction(unsigned, chain)
        const [signature] = signatures
        if (
            signatures.length !== 1 ||
            signature.requestIndex !== 0 ||
            signature.scheme !== 'secp256k1' ||
            !areEvmAddressesEqual(signature.signer, from)
        ) {
            throw new Error(
                'An EVM transaction takes exactly one secp256k1 signature, from its sender',
            )
        }
        const serialized = serializeTransaction(
            { ...transaction, type: 'eip1559' },
            toViemSignature(signature.bytes, 'eip155-tx'),
        )
        // Signers label signatures with the address they were asked for, not
        // the key that signed, so only recovery proves whose signature this is.
        const recovered = await recoverTransactionAddress({
            serializedTransaction: serialized,
        })
        if (!areEvmAddressesEqual(recovered, from)) {
            throw new Error(
                `The signature recovers to ${recovered}, not the sender ${from}`,
            )
        }
        return {
            scope: unsigned.scope,
            id: keccak256(serialized),
            bytes: hexToBytes(serialized),
        }
    },
})
