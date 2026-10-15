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
import type { ChainKeyStore } from '@perawallet/wallet-core-chain-contract'
import {
    personalMessageDigest,
    transactionDigest,
    typedDataDigest,
} from '../digests'
import type { TaggedDigest } from '../digests'
import { signTagged } from '../sign'
import type { AuthContext } from '../sign'
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

const signed = async (digest: TaggedDigest) =>
    signTagged(createVectorKeyStore().kms, KEY_PAIR_ID, digest)

describe('signTagged', () => {
    it.each([
        [TRANSFER, VIEM_TRANSFER_NONCE_0],
        [{ ...TRANSFER, nonce: 2 }, VIEM_TRANSFER_NONCE_2],
    ])('matches viem signTransaction for %#', async (transaction, expected) => {
        const signature = await signed(transactionDigest(transaction))

        expect(serializeTransaction(transaction, signature)).toBe(expected)
    })

    it.each([
        ['hello world', VIEM_HELLO_WORLD],
        ['Pera', VIEM_PERA],
    ])('matches viem signMessage for %s', async (message, expected) => {
        const signature = await signed(personalMessageDigest(message))

        expect(serializeSignature(signature)).toBe(expected)
    })

    it('matches viem signTypedData', async () => {
        const signature = await signed(typedDataDigest(MAIL_TYPED_DATA))

        expect(serializeSignature(signature)).toBe(VIEM_MAIL)
    })

    it('returns yParity and no v for a transaction', async () => {
        const signature = await signed(transactionDigest(TRANSFER))

        expect(signature.yParity).toBe(1)
        expect(signature.v).toBeUndefined()
    })

    it('returns v of 27 or 28 and no yParity for a message', async () => {
        const first = await signed(personalMessageDigest('hello world'))
        const second = await signed(personalMessageDigest('Pera'))

        expect([first.v, second.v]).toEqual([27n, 28n])
        expect(first.yParity).toBeUndefined()
        expect(second.yParity).toBeUndefined()
    })

    it('signs exactly the digest bytes in the accounts domain', async () => {
        const { kms, calls } = createVectorKeyStore()
        const digest = personalMessageDigest('Pera')

        await signTagged(kms, KEY_PAIR_ID, digest)

        expect(calls).toEqual([
            {
                keyPairId: KEY_PAIR_ID,
                payload: digest.digest,
                domain: 'pera.accounts',
            },
        ])
    })

    it('refuses a spread copy whose digest was swapped for a raw hash, before the KMS', async () => {
        const { kms, calls } = createVectorKeyStore()
        const forged = {
            ...personalMessageDigest('Pera'),
            digest: new Uint8Array(32).fill(7),
        } as TaggedDigest

        await expect(signTagged(kms, KEY_PAIR_ID, forged)).rejects.toThrow()
        expect(calls).toEqual([])
    })

    it('refuses a raw hash cast to a TaggedDigest, before the KMS', async () => {
        const { kms, calls } = createVectorKeyStore()
        const forged = {
            tag: 'eip155-tx',
            digest: new Uint8Array(32),
        } as unknown as TaggedDigest

        await expect(signTagged(kms, KEY_PAIR_ID, forged)).rejects.toThrow()
        expect(calls).toEqual([])
    })

    it('signs the minted bytes even after the exposed digest is mutated', async () => {
        const { kms, calls } = createVectorKeyStore()
        const digest = personalMessageDigest('Pera')
        const minted = digest.digest

        digest.digest.fill(0)

        await signTagged(kms, KEY_PAIR_ID, digest)
        expect(calls[0].payload).toEqual(minted)
    })

    it('signs identically when given an auth context', async () => {
        const auth: AuthContext = { method: 'app-unlock' }
        const plain = createVectorKeyStore()
        const authorised = createVectorKeyStore()
        const digest = transactionDigest(TRANSFER)

        const expected = await signTagged(plain.kms, KEY_PAIR_ID, digest)
        const actual = await signTagged(
            authorised.kms,
            KEY_PAIR_ID,
            digest,
            auth,
        )

        expect(actual).toEqual(expected)
        expect(authorised.calls).toEqual(plain.calls)
    })

    it.each([
        ['a 64-byte result', new Uint8Array(64)],
        ['a recovery byte of 2', Uint8Array.of(...new Uint8Array(64), 2)],
    ])('rejects %s from the key store', async (_label, malformed) => {
        const { kms } = createVectorKeyStore(() => malformed)

        await expect(
            signTagged(kms, KEY_PAIR_ID, transactionDigest(TRANSFER)),
        ).rejects.toThrow(
            'The key store returned a malformed secp256k1 signature',
        )
    })

    it('propagates a key store rejection unchanged', async () => {
        const denied = new Error('denied')
        const kms: Pick<ChainKeyStore, 'sign'> = {
            sign: async () => {
                throw denied
            },
        }

        await expect(
            signTagged(kms, KEY_PAIR_ID, transactionDigest(TRANSFER)),
        ).rejects.toBe(denied)
    })
})
