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

import { Transaction } from 'algosdk'
import type {
    Signature,
    SignedTransaction,
    SigningRequest,
    TransactionPlanner,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import { getExpectedGenesisHash } from '../blockchain'
import {
    encodeSignedTransaction,
    encodeTransaction,
    encodeTransactionRaw,
} from '../blockchain/utils/transact'
import { algorandAddressCodec } from '../accounts/address-codec'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../network-id'
import { generateMultisigAddress } from '../multisig/address'
import { assembleSignedMultisigTransactions } from '../multisig/assemble'
import { assertTransactionsMatchNetwork } from './assertTransactionsMatchNetwork'
import { assembleSignedTransaction } from './local-key/signTransactionsWithLocalKey'
import type { PeraTransaction } from '../blockchain/models/algosdk-shapes'

/**
 * The `UnsignedTransaction.payload` for scope chain `'algorand'`: the
 * transaction and who signs it, so planning reads nothing from the wallet.
 */
export type AlgorandTransactionPayload = {
    transaction: PeraTransaction
    /** The rekey authority that signs instead of the sender. */
    authorizer?: string
    /** The multisig that signs for the sender, or is its authority; its participants sign. */
    multisig?: MultisigParameters
}

type ReadTransaction = {
    transaction: PeraTransaction
    /** The address the signatures are for: the sender or its authority. */
    signer: string
    multisig?: MultisigParameters
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isAddress = (value: unknown): value is string =>
    typeof value === 'string' && algorandAddressCodec.isValid(value)

const isMultisigParameters = (value: unknown): value is MultisigParameters =>
    isRecord(value) &&
    Number.isInteger(value.version) &&
    Array.isArray(value.addresses) &&
    value.addresses.every(isAddress) &&
    Number.isInteger(value.threshold) &&
    (value.threshold as number) >= 1 &&
    (value.threshold as number) <= value.addresses.length

// `payload` is `unknown` and may come from a dApp, so this is the trust
// boundary for both `plan` and `assemble`.
export const readAlgorandTransaction = (
    unsigned: UnsignedTransaction,
): ReadTransaction => {
    const { scope, chainData, payload } = unsigned
    if (
        scope.chainId !== ALGORAND_CHAIN_ID ||
        chainData.family !== 'algorand'
    ) {
        throw new Error(
            `Not an Algorand transaction: ${scope.chainId}/${chainData.family}`,
        )
    }
    if (
        !isRecord(payload) ||
        !(payload.transaction instanceof Transaction) ||
        (payload.authorizer !== undefined && !isAddress(payload.authorizer)) ||
        (payload.multisig !== undefined &&
            !isMultisigParameters(payload.multisig))
    ) {
        throw new Error('The Algorand transaction payload is malformed')
    }
    const transaction = payload.transaction
    // A transaction for another network would be valid there.
    const network = algorandNetworkOf(scope)
    assertTransactionsMatchNetwork(
        [transaction],
        network,
        getExpectedGenesisHash(network),
    )
    const signer =
        (payload.authorizer as Optional<string>) ??
        transaction.sender.toString()
    const multisig = payload.multisig as Optional<MultisigParameters>
    // A participant list of the payload's choosing must be the multisig that
    // actually signs, or its members would sign for someone else.
    if (
        multisig &&
        generateMultisigAddress(
            multisig.version,
            multisig.threshold,
            multisig.addresses,
        ) !== signer
    ) {
        throw new Error(
            'The multisig does not derive to the address that signs',
        )
    }
    return { transaction, signer, multisig }
}

const ONE_SIGNATURE =
    'An Algorand transaction takes one ed25519 signature, from its signer'

const assembleSingle = (
    unsigned: UnsignedTransaction,
    { transaction, signer }: ReadTransaction,
    signatures: Signature[],
): SignedTransaction => {
    const [signature] = signatures
    if (
        signatures.length !== 1 ||
        signature.requestIndex !== 0 ||
        signature.scheme !== 'ed25519' ||
        signature.signer !== signer
    ) {
        throw new Error(ONE_SIGNATURE)
    }
    return {
        scope: unsigned.scope,
        id: transaction.txID(),
        bytes: encodeSignedTransaction(
            assembleSignedTransaction(transaction, {
                sig: signature.bytes,
                signerAddress: signer,
            }),
        ),
    }
}

// Participants without a signature stay as bare public keys, and the
// assembly verifies each signature, so fewer than the threshold fails.
const assembleMultisig = async (
    unsigned: UnsignedTransaction,
    { transaction, signer }: ReadTransaction,
    multisig: MultisigParameters,
    signatures: Signature[],
): Promise<SignedTransaction> => {
    const indices = new Set(signatures.map(s => s.requestIndex))
    if (
        signatures.length === 0 ||
        indices.size !== signatures.length ||
        signatures.some(
            s =>
                s.scheme !== 'ed25519' ||
                multisig.addresses[s.requestIndex] !== s.signer,
        )
    ) {
        throw new Error(
            'A multisig transaction takes ed25519 signatures, one per planned participant',
        )
    }
    const result = await assembleSignedMultisigTransactions({
        rawTransactionsBase64: [
            encodeToBase64(encodeTransactionRaw(transaction)),
        ],
        participantAddresses: multisig.addresses,
        version: multisig.version,
        threshold: multisig.threshold,
        responses: signatures.map(s => ({
            address: s.signer,
            response: 'signed' as const,
            signatures: [encodeToBase64(s.bytes)],
        })),
        multisigAddress: signer,
    })
    if (result.kind === 'insufficient-signatures') {
        throw new Error(
            `The multisig needs ${result.threshold} signatures, not ${result.validCount}`,
        )
    }
    if (result.kind === 'error') throw new Error(result.reason)
    return {
        scope: unsigned.scope,
        id: transaction.txID(),
        bytes: result.signedTransactionsBytes[0],
    }
}

export const algorandTransactionPlanner: TransactionPlanner = {
    chainId: ALGORAND_CHAIN_ID,

    plan: (unsigned): SigningRequest[] => {
        const { transaction, signer, multisig } =
            readAlgorandTransaction(unsigned)
        const payload = encodeTransaction(transaction)
        // The Algorand Ledger app adds the signing-domain prefix itself.
        const devicePayload = encodeTransactionRaw(transaction)
        return (multisig?.addresses ?? [signer]).map(
            (address, requestIndex) => ({
                requestIndex,
                signer: address,
                scheme: 'ed25519',
                payload: payload.slice(),
                devicePayload: devicePayload.slice(),
            }),
        )
    },

    assemble: (unsigned, signatures) => {
        const read = readAlgorandTransaction(unsigned)
        return read.multisig
            ? assembleMultisig(unsigned, read, read.multisig, signatures)
            : assembleSingle(unsigned, read, signatures)
    },
}
