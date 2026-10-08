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

import { describe, expect, it } from 'vitest'
import {
    hashMessage,
    hashTypedData,
    hexToBytes,
    keccak256,
    serializeTransaction,
} from 'viem'
import {
    personalMessageDigest,
    transactionDigest,
    typedDataDigest,
} from '../digests'
import type { TaggedDigest } from '../digests'
import { MAIL_TYPED_DATA, TRANSFER } from './fixtures'

describe('digests', () => {
    it('hashes a transaction as the unsigned EIP-1559 typed form', () => {
        const result: TaggedDigest = transactionDigest(TRANSFER)

        expect(result.tag).toBe('eip155-tx')
        expect(result.digest).toEqual(
            keccak256(serializeTransaction(TRANSFER), 'bytes'),
        )
        expect(result.digest).toHaveLength(32)
    })

    it('hashes a transaction without a type as the EIP-1559 form', () => {
        const { type: _type, ...untyped } = TRANSFER

        expect(transactionDigest(untyped).digest).toEqual(
            transactionDigest(TRANSFER).digest,
        )
    })

    it('applies the personal_sign prefix to a message', () => {
        const result = personalMessageDigest('hello world')

        expect(result.tag).toBe('eip191-message')
        expect(result.digest).toEqual(hashMessage('hello world', 'bytes'))
        expect(result.digest).toHaveLength(32)
    })

    it('hashes a raw payload as bytes rather than as text', () => {
        const raw = personalMessageDigest({ raw: '0xdeadbeef' })

        expect(raw.digest).toEqual(hashMessage({ raw: '0xdeadbeef' }, 'bytes'))
        expect(raw.digest).not.toEqual(
            personalMessageDigest('0xdeadbeef').digest,
        )
    })

    it('hashes typed data as the EIP-712 domain and struct hash', () => {
        const result = typedDataDigest(MAIL_TYPED_DATA)

        expect(result.tag).toBe('eip712')
        expect(result.digest).toEqual(
            hexToBytes(hashTypedData(MAIL_TYPED_DATA)),
        )
        expect(result.digest).toHaveLength(32)
    })

    it('throws on malformed typed data before anything can be signed', () => {
        const malformed = {
            ...MAIL_TYPED_DATA,
            message: {
                ...MAIL_TYPED_DATA.message,
                to: { name: 'Bob', wallet: '0x123' },
            },
        }

        expect(() => typedDataDigest(malformed)).toThrow()
    })
})
