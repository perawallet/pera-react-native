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
    /** The 32-byte keccak256 the key signs; a copy, so mutating it changes nothing signed. */
    readonly digest: Uint8Array
    readonly __taggedDigest: unique symbol
}

type MintedDigest = { tag: TaggedDigest['tag']; digest: Uint8Array }

// The brand is erased at runtime, so the type alone can't stop a spread copy
// with its digest swapped for a raw hash. Signing reads only what was minted here.
const minted = new WeakMap<TaggedDigest, MintedDigest>()

const DIGEST_LENGTH = 32

const tagged = (tag: TaggedDigest['tag'], digest: Uint8Array): TaggedDigest => {
    const bytes = Uint8Array.from(digest)
    const handle = Object.freeze({
        tag,
        get digest() {
            return Uint8Array.from(bytes)
        },
    }) as unknown as TaggedDigest
    minted.set(handle, { tag, digest: bytes })
    return handle
}

/**
 * The tag and a copy of the bytes a hasher here minted.
 * @throws when `digest` was not minted by this module, e.g. a spread copy or a cast raw hash.
 */
export const openTaggedDigest = (digest: TaggedDigest): MintedDigest => {
    const held = minted.get(digest)
    if (!held || held.digest.length !== DIGEST_LENGTH) {
        throw new Error('Refusing to sign a digest no Ethereum hasher minted')
    }
    return { tag: held.tag, digest: Uint8Array.from(held.digest) }
}

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
