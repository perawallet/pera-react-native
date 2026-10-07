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

// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { hexToBytes } from '@noble/hashes/utils.js'
import {
    consumeKeyMaterial,
    createKeyHandle,
    InvalidKeyDataError,
    MaterialAccessError,
} from '@algorandfoundation/keystore-core'
import { secp256k1Binding, type Secp256k1Binding } from '../binding'
import { SECP256K1_ALGORITHM, withSubtleSecp256k1 } from '../shim'

// Every secret buffer the derivation produces, captured to check it ends zeroed.
const produced = vi.hoisted((): Uint8Array[] => [])

vi.mock('../bip39Seed', async importOriginal => {
    const actual = await importOriginal<typeof import('../bip39Seed')>()
    return {
        ...actual,
        bip39SeedFromEntropy: async (
            subtle: SubtleCrypto,
            entropy: Uint8Array,
        ) => {
            const seed = await actual.bip39SeedFromEntropy(subtle, entropy)
            produced.push(seed)
            return seed
        },
    }
})

const host = globalThis.crypto.subtle
const PATH = "m/44'/60'/0'/0/0"
const PRIVATE_KEY = hexToBytes(
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const handle = () =>
    createKeyHandle('private', { name: SECP256K1_ALGORITHM }, false, ['sign'])

const isZero = (bytes: Uint8Array): boolean => bytes.every(b => b === 0)

const capturingBinding: Secp256k1Binding = {
    ...secp256k1Binding,
    deriveChildPrivateKey: (seed, path) => {
        const key = secp256k1Binding.deriveChildPrivateKey(seed, path)
        produced.push(key)
        return key
    },
}

const shim = () => withSubtleSecp256k1(host, capturingBinding)

describe('withSubtleSecp256k1', () => {
    beforeEach(() => {
        produced.length = 0
    })

    test('generateKey hands the child to the engine once and leaves no secret behind', async () => {
        const entropy = new Uint8Array(32).fill(3)

        const pair = (await shim().generateKey(
            {
                name: SECP256K1_ALGORITHM,
                entropy,
                path: PATH,
            } as AlgorithmIdentifier,
            false,
            ['sign', 'verify'],
        )) as CryptoKeyPair

        const [seed, child] = produced
        expect(isZero(seed)).toBe(true)
        expect(isZero(entropy)).toBe(true)
        const material = consumeKeyMaterial(pair.privateKey, m =>
            Uint8Array.from(m),
        )
        expect(material).toHaveLength(32)
        expect(isZero(child)).toBe(true)
        expect(() => consumeKeyMaterial(pair.privateKey, m => m)).toThrow()
        const publicKey = consumeKeyMaterial(pair.publicKey, m =>
            Uint8Array.from(m),
        )
        expect(publicKey).toEqual(secp256k1Binding.publicKeyOf(material))
    })

    test('a malformed path is refused before the seed is computed', async () => {
        const entropy = new Uint8Array(32).fill(3)

        await expect(
            shim().generateKey(
                {
                    name: SECP256K1_ALGORITHM,
                    entropy,
                    path: "44'/60'",
                } as AlgorithmIdentifier,
                false,
                ['sign'],
            ),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
        expect(produced).toHaveLength(0)
        expect(isZero(entropy)).toBe(true)
    })

    test('deriveBits returns the public key and zeroes the injected key', async () => {
        const privateKey = Uint8Array.from(PRIVATE_KEY)

        const bits = await shim().deriveBits(
            { name: SECP256K1_ALGORITHM, privateKey } as AlgorithmIdentifier,
            handle(),
        )

        expect(new Uint8Array(bits)).toEqual(
            secp256k1Binding.publicKeyOf(PRIVATE_KEY),
        )
        expect(isZero(privateKey)).toBe(true)
    })

    test('sign returns r‖s‖yParity and zeroes the injected key', async () => {
        const privateKey = Uint8Array.from(PRIVATE_KEY)
        const digest = new Uint8Array(32).fill(9)

        const signature = await shim().sign(
            { name: SECP256K1_ALGORITHM, privateKey } as AlgorithmIdentifier,
            handle(),
            digest,
        )

        expect(new Uint8Array(signature)).toEqual(
            secp256k1Binding.signDigest(PRIVATE_KEY, digest),
        )
        expect(isZero(privateKey)).toBe(true)
    })

    test('sign refuses a digest that is not 32 bytes', async () => {
        const privateKey = Uint8Array.from(PRIVATE_KEY)

        await expect(
            shim().sign(
                {
                    name: SECP256K1_ALGORITHM,
                    privateKey,
                } as AlgorithmIdentifier,
                handle(),
                new Uint8Array(33),
            ),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
        expect(isZero(privateKey)).toBe(true)
    })

    test('key material can neither be imported nor exported', async () => {
        await expect(
            shim().importKey(
                'raw',
                PRIVATE_KEY,
                { name: SECP256K1_ALGORITHM },
                false,
                ['sign'],
            ),
        ).rejects.toBeInstanceOf(MaterialAccessError)
        await expect(shim().exportKey('raw', handle())).rejects.toBeInstanceOf(
            MaterialAccessError,
        )
    })

    test('other algorithms reach the host', async () => {
        const digest = await shim().digest('SHA-256', new Uint8Array([1]))

        expect(new Uint8Array(digest)).toEqual(
            new Uint8Array(await host.digest('SHA-256', new Uint8Array([1]))),
        )
    })
})
