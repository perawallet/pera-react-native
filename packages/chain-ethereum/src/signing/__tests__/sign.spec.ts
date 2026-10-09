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
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_2,
    createVectorKeyStore,
} from './fixtures'

// viem's own `signMessage` and `signTypedData` output under the same key as the
// transaction vectors in `fixtures.ts`; never derived from them.
const VIEM_HELLO_WORLD =
    '0xa461f509887bd19e312c0c58467ce8ff8e300d3c1a90b608a760c5b80318eaf15fe57c96f9175d6cd4daad4663763baa7e78836e067d0163e9a2ccf2ff753f5b1b'
const VIEM_PERA =
    '0xe04588d881d59ef43990fd1bdd2e05bce76c3052620432089e1d632b6d4bc3884930cf24da1dda4ff05d7dffee6605f6ab807db2cfe2ff01dd73054883b6e8161c'
const VIEM_MAIL =
    '0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a1b'

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
