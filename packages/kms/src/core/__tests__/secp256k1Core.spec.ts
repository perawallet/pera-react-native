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
import * as secp from '@noble/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import type {
    Key,
    KeyStoreAPI,
    SecretOptions,
} from '@algorandfoundation/keystore-core'
import {
    InvalidKeyError,
    KeyAccessError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../errors'
import { SeedScheme, SIGNING_ACCESS_DOMAIN } from '../../constants'
import { entropyChildMetadata } from '../../utils'
import { indicesToEntropy } from '../../crypto/hdwallet-utils'
import { mnemonicWordsToIndices } from '../../crypto/mnemonic-indices'
import { secp256k1PublicKeyOf } from '../../crypto/secp256k1'
import {
    decodeSecp256k1Signature,
    secp256k1SignKeyId,
    type Secp256k1KeyMetadata,
} from '../../models/keys'
import { createKmsCore } from '../createKmsCore'

// Every secret buffer the derivation produces, captured to check it ends zeroed.
const produced = vi.hoisted((): Uint8Array[] => [])

vi.mock('../../crypto/hdwallet-utils', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../../crypto/hdwallet-utils')>()
    return {
        ...actual,
        bip39SeedFromEntropy: async (entropy: Uint8Array) => {
            const seed = await actual.bip39SeedFromEntropy(entropy)
            produced.push(seed)
            return seed
        },
    }
})

vi.mock('../../crypto/secp256k1', async importOriginal => {
    const actual =
        await importOriginal<typeof import('../../crypto/secp256k1')>()
    return {
        ...actual,
        deriveSecp256k1PrivateKey: (seed: Uint8Array, path: string) => {
            const key = actual.deriveSecp256k1PrivateKey(seed, path)
            produced.push(key)
            return key
        },
    }
})

const FOREIGN_DOMAIN = 'evil.example'
const SEED_ID = 'seed-1'
const ENTROPY_ID = 'seed-1-entropy'
const FIRST_PATH = "m/44'/60'/0'/0/0"
const FIRST_ID = secp256k1SignKeyId(SEED_ID, 0, 0)
const TEST_WORDS = 'test test test test test test test test test test test junk'
// The key and address MetaMask (and Hardhat) list first for TEST_WORDS.
const FIRST_PRIVATE_KEY = hexToBytes(
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const FIRST_ADDRESS = 'f39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const CURVE_ORDER = secp.Point.CURVE().n

const scalarBytes = (value: bigint): Uint8Array =>
    hexToBytes(value.toString(16).padStart(64, '0'))

const isZero = (bytes: Uint8Array): boolean => bytes.every(b => b === 0)

let keys: Key[]
let sealed: Map<string, Uint8Array>

const secretsGet = vi.fn(async (id: string) => {
    const value = sealed.get(id)
    if (!value) throw new KeyNotFoundError(id)
    const copy = new Uint8Array(value)
    produced.push(copy)
    return copy
})
const secretsPut = vi.fn(
    async (value: Uint8Array | string, options?: SecretOptions) => {
        const id = options!.id!
        sealed.set(id, new Uint8Array(value as Uint8Array))
        keys = [
            ...keys,
            {
                id,
                type: 'secret-key',
                algorithm: 'raw',
                extractable: false,
                metadata: options?.metadata ?? {},
            },
        ]
        return id
    },
)
const keystoreSign = vi.fn()
const keystoreImport = vi.fn()
const keystoreDerive = vi.fn()

const keyStore = () =>
    ({
        secrets: { get: secretsGet, put: secretsPut },
        sign: keystoreSign,
        import: keystoreImport,
        deriveFromSeed: keystoreDerive,
    }) as unknown as KeyStoreAPI

const makeCore = () => createKmsCore({ keyStore, keys: () => keys })

const seedKey = (scheme: string = SeedScheme.Bip39): Key => ({
    id: SEED_ID,
    type: 'hd-root-key',
    algorithm: 'raw',
    extractable: true,
    metadata: { scheme },
})

const entropyKey = (): Key => ({
    id: ENTROPY_ID,
    type: 'secret-key',
    algorithm: 'raw',
    extractable: false,
    metadata: entropyChildMetadata(SEED_ID),
})

const addressOf = (publicKey: Uint8Array): string =>
    bytesToHex(keccak_256(publicKey.slice(1)).slice(-20))

const verifies = (
    signature: { r: Uint8Array; s: Uint8Array },
    digest: Uint8Array,
    publicKey: Uint8Array,
): boolean =>
    secp.verify(
        new Uint8Array([...signature.r, ...signature.s]),
        digest,
        publicKey,
        { prehash: false },
    )

const expectNoSecretRead = () => {
    expect(secretsGet).not.toHaveBeenCalled()
    expect(secretsPut).not.toHaveBeenCalled()
    expect(keystoreSign).not.toHaveBeenCalled()
}

const deriveFirst = (domain = SIGNING_ACCESS_DOMAIN) =>
    makeCore().deriveSecp256k1Child(
        SEED_ID,
        { path: FIRST_PATH, id: FIRST_ID },
        domain,
    )

const importFirst = (parentKeyId?: string) =>
    makeCore().importSecp256k1Key(
        new Uint8Array(FIRST_PRIVATE_KEY),
        { id: 'imported-1', ...(parentKeyId ? { parentKeyId } : {}) },
        SIGNING_ACCESS_DOMAIN,
    )

describe('createKmsCore secp256k1', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        produced.length = 0
        const entropy = indicesToEntropy(
            mnemonicWordsToIndices(TEST_WORDS.split(' '))!,
        )
        sealed = new Map([[ENTROPY_ID, entropy]])
        keys = [seedKey(), entropyKey()]
    })

    describe('deriveSecp256k1Child', () => {
        test("derives MetaMask's first key from the test mnemonic", async () => {
            const { keyPairId, publicKey } = await deriveFirst()

            expect(keyPairId).toBe(FIRST_ID)
            expect(publicKey).toEqual(secp256k1PublicKeyOf(FIRST_PRIVATE_KEY))
            expect(addressOf(publicKey)).toBe(FIRST_ADDRESS)
        })

        test('stores the key as a secret under the seed, marked derived', async () => {
            const { publicKey } = await deriveFirst()

            expect(sealed.get(FIRST_ID)).toEqual(FIRST_PRIVATE_KEY)
            const metadata: Secp256k1KeyMetadata = {
                parentKeyId: SEED_ID,
                pera: {
                    keyScheme: 'secp256k1',
                    origin: 'derived',
                    publicKey: bytesToHex(publicKey),
                },
            }
            expect(secretsPut).toHaveBeenCalledWith(expect.any(Uint8Array), {
                id: FIRST_ID,
                metadata,
            })
        })

        test('zeroes the entropy, the seed and the child key once it returns', async () => {
            await deriveFirst()

            // entropy, BIP-39 seed, child private key
            expect(produced).toHaveLength(3)
            expect(produced.every(isZero)).toBe(true)
        })

        test('a malformed path is refused before any secret is read', async () => {
            await expect(
                makeCore().deriveSecp256k1Child(
                    SEED_ID,
                    { path: "44'/60'", id: FIRST_ID },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)

            expect(produced).toHaveLength(0)
            expectNoSecretRead()
        })

        test('re-deriving the same id returns the stored entry without a second write', async () => {
            const first = await deriveFirst()

            const second = await deriveFirst()

            expect(second).toEqual(first)
            expect(secretsPut).toHaveBeenCalledTimes(1)
        })

        test('an id already holding a different key is refused', async () => {
            await deriveFirst()

            await expect(
                makeCore().deriveSecp256k1Child(
                    SEED_ID,
                    { path: "m/44'/60'/0'/0/1", id: FIRST_ID },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expect(secretsPut).toHaveBeenCalledTimes(1)
        })

        test('importing the same key under a derived id is refused', async () => {
            await deriveFirst()
            const input = new Uint8Array(FIRST_PRIVATE_KEY)

            await expect(
                makeCore().importSecp256k1Key(
                    input,
                    { id: FIRST_ID },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expect(secretsPut).toHaveBeenCalledTimes(1)
            expect(isZero(input)).toBe(true)
        })

        test.each([SeedScheme.Algo25, SeedScheme.Quantum])(
            'refuses a %s seed before reading any secret',
            async scheme => {
                keys = [seedKey(scheme), entropyKey()]

                await expect(deriveFirst()).rejects.toBeInstanceOf(
                    KeyManagementError,
                )
                expectNoSecretRead()
            },
        )

        test('a foreign domain is refused before reading any secret', async () => {
            await expect(deriveFirst(FOREIGN_DOMAIN)).rejects.toBeInstanceOf(
                KeyAccessError,
            )
            expectNoSecretRead()
        })
    })

    describe('signSecp256k1Digest', () => {
        test.each([31, 33])(
            'a %d-byte digest throws before any keystore call',
            async length => {
                await deriveFirst()
                vi.clearAllMocks()

                await expect(
                    makeCore().signSecp256k1Digest(
                        FIRST_ID,
                        new Uint8Array(length),
                        SIGNING_ACCESS_DOMAIN,
                    ),
                ).rejects.toBeInstanceOf(KeyManagementError)
                expectNoSecretRead()
            },
        )

        test('the signature verifies against the derived public key and is low-s', async () => {
            const { publicKey } = await deriveFirst()
            const digest = new Uint8Array(32).fill(0xab)

            const signature = await makeCore().signSecp256k1Digest(
                FIRST_ID,
                digest,
                SIGNING_ACCESS_DOMAIN,
            )

            expect(verifies(signature, digest, publicKey)).toBe(true)
            expect(
                BigInt(`0x${bytesToHex(signature.s)}`) <= CURVE_ORDER / 2n,
            ).toBe(true)
        })

        test('zeroes the private key it reads', async () => {
            await deriveFirst()
            produced.length = 0

            await makeCore().signSecp256k1Digest(
                FIRST_ID,
                new Uint8Array(32).fill(1),
                SIGNING_ACCESS_DOMAIN,
            )

            expect(produced).toHaveLength(1)
            expect(isZero(produced[0])).toBe(true)
        })

        test('a foreign domain is refused before the key is read', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().signSecp256k1Digest(
                    FIRST_ID,
                    new Uint8Array(32),
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(secretsGet).not.toHaveBeenCalled()
        })

        test('a parentless imported key signs under the default ACL', async () => {
            const { publicKey } = await importFirst()
            const digest = new Uint8Array(32).fill(0x42)

            const signature = await makeCore().signSecp256k1Digest(
                'imported-1',
                digest,
                SIGNING_ACCESS_DOMAIN,
            )

            expect(verifies(signature, digest, publicKey)).toBe(true)
        })

        test('an ed25519 child is not a secp256k1 key', async () => {
            keys.push({
                id: 'ed-1',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                metadata: { parentKeyId: SEED_ID },
            })

            await expect(
                makeCore().signSecp256k1Digest(
                    'ed-1',
                    new Uint8Array(32),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(InvalidKeyError)
        })

        test('an unknown id is not found', async () => {
            await expect(
                makeCore().signSecp256k1Digest(
                    'missing',
                    new Uint8Array(32),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyNotFoundError)
        })
    })

    describe('importSecp256k1Key', () => {
        test.each([
            ['a zero key', new Uint8Array(32)],
            ['the curve order', scalarBytes(CURVE_ORDER)],
            ['a 31-byte key', new Uint8Array(31).fill(1)],
        ])(
            'rejects %s before any keystore call and zeroes it',
            async (_label, key) => {
                await expect(
                    makeCore().importSecp256k1Key(
                        key,
                        { id: 'imported-1' },
                        SIGNING_ACCESS_DOMAIN,
                    ),
                ).rejects.toBeInstanceOf(InvalidKeyError)
                expectNoSecretRead()
                expect(isZero(key)).toBe(true)
            },
        )

        test('stores a valid key marked imported and zeroes the input', async () => {
            const input = new Uint8Array(FIRST_PRIVATE_KEY)

            const { keyPairId, publicKey } =
                await makeCore().importSecp256k1Key(
                    input,
                    { id: 'imported-1' },
                    SIGNING_ACCESS_DOMAIN,
                )

            expect(keyPairId).toBe('imported-1')
            expect(publicKey).toEqual(secp256k1PublicKeyOf(FIRST_PRIVATE_KEY))
            expect(sealed.get('imported-1')).toEqual(FIRST_PRIVATE_KEY)
            expect(secretsPut.mock.calls[0][1]?.metadata).toEqual({
                pera: {
                    keyScheme: 'secp256k1',
                    origin: 'imported',
                    publicKey: bytesToHex(publicKey),
                },
            })
            expect(isZero(input)).toBe(true)
        })

        test('a parentless import under a foreign domain is refused', async () => {
            const input = new Uint8Array(FIRST_PRIVATE_KEY)

            await expect(
                makeCore().importSecp256k1Key(
                    input,
                    { id: 'imported-1' },
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoSecretRead()
            expect(isZero(input)).toBe(true)
        })
    })

    describe('exportSecp256k1Key', () => {
        test('a derived child is never exported', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().exportSecp256k1Key(FIRST_ID, SIGNING_ACCESS_DOMAIN),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(secretsGet).not.toHaveBeenCalled()
        })

        test('an imported key returns its bytes', async () => {
            await importFirst()

            const bytes = await makeCore().exportSecp256k1Key(
                'imported-1',
                SIGNING_ACCESS_DOMAIN,
            )

            expect(bytes).toEqual(FIRST_PRIVATE_KEY)
        })

        test('a foreign domain is refused before the key is read', async () => {
            await importFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().exportSecp256k1Key('imported-1', FOREIGN_DOMAIN),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(secretsGet).not.toHaveBeenCalled()
        })
    })

    describe('the chain-facing port', () => {
        test('deriveFromSeed with the secp256k1 scheme derives through the secrets store', async () => {
            const derived = await makeCore().deriveFromSeed(
                SEED_ID,
                { scheme: 'secp256k1', path: FIRST_PATH, id: FIRST_ID },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(addressOf(derived.publicKey)).toBe(FIRST_ADDRESS)
            expect(keystoreDerive).not.toHaveBeenCalled()
        })

        test('importRawKey with the secp256k1 scheme imports through the secrets store', async () => {
            const input = new Uint8Array(FIRST_PRIVATE_KEY)

            const imported = await makeCore().importRawKey(
                input,
                { scheme: 'secp256k1', id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(imported.publicKey).toEqual(
                secp256k1PublicKeyOf(FIRST_PRIVATE_KEY),
            )
            expect(keystoreImport).not.toHaveBeenCalled()
            expect(isZero(input)).toBe(true)
        })

        test('sign on a secp256k1 key returns r‖s‖recovery', async () => {
            const { publicKey } = await deriveFirst()
            const digest = new Uint8Array(32).fill(0x0c)

            const bytes = await makeCore().sign(
                FIRST_ID,
                digest,
                SIGNING_ACCESS_DOMAIN,
            )

            expect(bytes).toHaveLength(65)
            const signature = decodeSecp256k1Signature(bytes)
            expect(verifies(signature, digest, publicKey)).toBe(true)
            const recovered = secp.recoverPublicKey(
                new Uint8Array([
                    signature.recovery,
                    ...signature.r,
                    ...signature.s,
                ]),
                digest,
                { prehash: false },
            )
            expect(recovered).toEqual(secp.getPublicKey(FIRST_PRIVATE_KEY))
            expect(keystoreSign).not.toHaveBeenCalled()
        })

        test('sign on an ed25519 child still goes to the keystore', async () => {
            keys.push({
                id: 'ed-1',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                metadata: { parentKeyId: SEED_ID },
            })
            keystoreSign.mockResolvedValue(new Uint8Array(64))

            await makeCore().sign(
                'ed-1',
                new Uint8Array([1]),
                SIGNING_ACCESS_DOMAIN,
            )

            expect(keystoreSign).toHaveBeenCalledWith(
                'ed-1',
                new Uint8Array([1]),
            )
        })
    })
})
