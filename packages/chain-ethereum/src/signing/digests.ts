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
    hashMessage,
    hashTypedData,
    hexToBytes,
    keccak256,
    serializeTransaction,
} from 'viem'
import type {
    SignableMessage,
    TransactionSerializableEIP1559,
    TypedData,
    TypedDataDefinition,
} from 'viem'

/** Only this module's hashers mint one, so a raw hash (`eth_sign`'s payload) cannot reach the key. */
export type TaggedDigest = {
    readonly tag: 'eip155-tx' | 'eip191-message' | 'eip712'
    /** The 32-byte keccak256 the key signs. */
    readonly digest: Uint8Array
    readonly __taggedDigest: unique symbol
}

const tagged = (tag: TaggedDigest['tag'], digest: Uint8Array): TaggedDigest =>
    ({ tag, digest }) as TaggedDigest

/** Forcing `type` pins the typed (0x02) RLP form even when the caller left it off. */
export const transactionDigest = (
    transaction: TransactionSerializableEIP1559,
): TaggedDigest =>
    tagged(
        'eip155-tx',
        keccak256(
            serializeTransaction({ ...transaction, type: 'eip1559' }),
            'bytes',
        ),
    )

export const personalMessageDigest = (message: SignableMessage): TaggedDigest =>
    tagged('eip191-message', hashMessage(message, 'bytes'))

export const typedDataDigest = <
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | 'EIP712Domain',
>(
    typedData: TypedDataDefinition<typedData, primaryType>,
): TaggedDigest => tagged('eip712', hexToBytes(hashTypedData(typedData)))
