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
    bytesToHex,
    hexToBytes,
    serializeSignature,
    serializeTransaction,
} from 'viem'
import type { Hex } from 'viem'
import type { ChainKeyStore } from '@perawallet/wallet-core-chain-contract'
import {
    personalMessageDigest,
    transactionDigest,
    typedDataDigest,
} from '../digests'
import type { TaggedDigest } from '../digests'
import { signTagged } from '../sign'
import type { AuthContext } from '../sign'
import { MAIL_TYPED_DATA, TRANSFER } from './fixtures'

// Hardhat account #0 (`m/44'/60'/0'/0/0` of `test test test test test test
// test test test test test junk`). This package's tests may not hold a
// secp256k1 key (see `firewall.spec.ts`), so the key store answers from
// signatures generated with viem's `sign`, keyed by the digest they sign.
const KMS_SIGNATURES: Record<Hex, Hex> = {
    '0x82afed965c7aa87b5689c5eb049f2b77e23ae7819f6e081b8a3198c1ed5195f8':
        '0x0a3a2646d4ad968bb56317fdb15e17fb4d9deec0d03e8b6cb05e7125bda3006d26618ad17cc63cf1979ca75f850c536a073ec88ab1ab7c8db8b8eb129499d9ae01',
    '0xf2eee62b3b68eff7c15e0808683e7762c85051cceebe641f4b77b026788a98c1':
        '0x082e76302cca13d703850329a812776dd29a70054c6f17ee6a5dff9cfad917cd6bb6ba4e6095246f7cbb722eec394bc5d8b4617bb1d9cb2a9dbdf953d95bd28b00',
    '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68':
        '0xa461f509887bd19e312c0c58467ce8ff8e300d3c1a90b608a760c5b80318eaf15fe57c96f9175d6cd4daad4663763baa7e78836e067d0163e9a2ccf2ff753f5b00',
    '0x8921f2eb8a76968e7210d7a56c38b3acf933ccc72e8c50db48cc55aaf1a6fe0d':
        '0xe04588d881d59ef43990fd1bdd2e05bce76c3052620432089e1d632b6d4bc3884930cf24da1dda4ff05d7dffee6605f6ab807db2cfe2ff01dd73054883b6e81601',
    '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2':
        '0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a00',
}

// viem's own `signTransaction`, `signMessage` and `signTypedData` output for
// the same inputs under the same key; never derived from the vectors above.
const VIEM_TRANSFER_NONCE_0 =
    '0x02f8730180843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c001a00a3a2646d4ad968bb56317fdb15e17fb4d9deec0d03e8b6cb05e7125bda3006da026618ad17cc63cf1979ca75f850c536a073ec88ab1ab7c8db8b8eb129499d9ae'
const VIEM_TRANSFER_NONCE_2 =
    '0x02f8730102843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c080a0082e76302cca13d703850329a812776dd29a70054c6f17ee6a5dff9cfad917cda06bb6ba4e6095246f7cbb722eec394bc5d8b4617bb1d9cb2a9dbdf953d95bd28b'
const VIEM_HELLO_WORLD =
    '0xa461f509887bd19e312c0c58467ce8ff8e300d3c1a90b608a760c5b80318eaf15fe57c96f9175d6cd4daad4663763baa7e78836e067d0163e9a2ccf2ff753f5b1b'
const VIEM_PERA =
    '0xe04588d881d59ef43990fd1bdd2e05bce76c3052620432089e1d632b6d4bc3884930cf24da1dda4ff05d7dffee6605f6ab807db2cfe2ff01dd73054883b6e8161c'
const VIEM_MAIL =
    '0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a1b'

const KEY_PAIR_ID = 'kms-entry-1'

type SignCall = { keyPairId: string; payload: Uint8Array; domain: string }

const createVectorKeyStore = (
    override?: (digest: Hex) => Uint8Array | undefined,
) => {
    const calls: SignCall[] = []
    const kms: Pick<ChainKeyStore, 'sign'> = {
        sign: async (keyPairId, payload, domain) => {
            calls.push({ keyPairId, payload, domain })
            const digest = bytesToHex(payload)
            const overridden = override?.(digest)
            if (overridden) return overridden
            const signature = KMS_SIGNATURES[digest]
            if (!signature) throw new Error(`no vector for ${digest}`)
            return hexToBytes(signature)
        },
    }
    return { kms, calls }
}

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
