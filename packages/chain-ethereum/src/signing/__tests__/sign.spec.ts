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
import { serializeSignature, serializeTransaction } from 'viem'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import {
    personalMessageDigest,
    transactionDigest,
    typedDataDigest,
} from '../digests'
import type { EvmDigestKind } from '../digests'
import { toViemSignature } from '../sign'
import {
    MAIL_TYPED_DATA,
    TRANSFER,
    VIEM_HELLO_WORLD,
    VIEM_MAIL,
    VIEM_PERA,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_2,
    createVectorKeyStore,
} from './fixtures'

const KEY_PAIR_ID = 'kms-entry-1'

const signed = async (digest: Uint8Array, kind: EvmDigestKind) =>
    toViemSignature(
        await createVectorKeyStore().kms.sign(
            KEY_PAIR_ID,
            digest,
            SIGNING_ACCESS_DOMAIN,
        ),
        kind,
    )

describe('toViemSignature', () => {
    it.each([
        [TRANSFER, VIEM_TRANSFER_NONCE_0],
        [{ ...TRANSFER, nonce: 2 }, VIEM_TRANSFER_NONCE_2],
    ])('matches viem signTransaction for %#', async (transaction, expected) => {
        const signature = await signed(
            transactionDigest(transaction),
            'eip155-tx',
        )

        expect(serializeTransaction(transaction, signature)).toBe(expected)
    })

    it.each([
        ['hello world', VIEM_HELLO_WORLD],
        ['Pera', VIEM_PERA],
    ])('matches viem signMessage for %s', async (message, expected) => {
        const signature = await signed(
            personalMessageDigest(message),
            'eip191-message',
        )

        expect(serializeSignature(signature)).toBe(expected)
    })

    it('matches viem signTypedData', async () => {
        const signature = await signed(
            typedDataDigest(MAIL_TYPED_DATA),
            'eip712',
        )

        expect(serializeSignature(signature)).toBe(VIEM_MAIL)
    })

    it('returns yParity and no v for a transaction', async () => {
        const signature = await signed(transactionDigest(TRANSFER), 'eip155-tx')

        expect(signature.yParity).toBe(1)
        expect(signature.v).toBeUndefined()
    })

    it('returns v of 27 or 28 and no yParity for a message', async () => {
        const first = await signed(
            personalMessageDigest('hello world'),
            'eip191-message',
        )
        const second = await signed(personalMessageDigest('Pera'), 'eip712')

        expect([first.v, second.v]).toEqual([27n, 28n])
        expect(first.yParity).toBeUndefined()
        expect(second.yParity).toBeUndefined()
    })

    it.each([
        ['a 64-byte signature', new Uint8Array(64)],
        ['a recovery byte of 2', Uint8Array.of(...new Uint8Array(64), 2)],
    ])('rejects %s', (_label, malformed) => {
        expect(() => toViemSignature(malformed, 'eip155-tx')).toThrow(
            'The key store returned a malformed secp256k1 signature',
        )
    })
})
