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
import type {
    DeriveOptions,
    Key,
    KeyData,
    KeyStoreAPI,
} from '@algorandfoundation/keystore-core'
import {
    InvalidKeyError,
    KeyAccessError,
    KeyManagementError,
    KeyNotFoundError,
} from '../../errors'
import { SeedScheme, SIGNING_ACCESS_DOMAIN } from '../../constants'
import { entropyChildMetadata } from '../../utils'
import {
    SECP256K1_DERIVED_KEY_TYPE,
    SECP256K1_IMPORTED_KEY_TYPE,
    SECP256K1_KEY_ALGORITHM,
    decodeSecp256k1Signature,
    secp256k1SignKeyId,
} from '../../models/keys'
import { createKmsCore } from '../createKmsCore'

const FOREIGN_DOMAIN = 'evil.example'
const SEED_ID = 'seed-1'
const ENTROPY_ID = 'seed-1-entropy'
const FIRST_PATH = "m/44'/60'/0'/0/0"
const FIRST_ID = secp256k1SignKeyId(SEED_ID, 0, 0)
const PUBLIC_KEY = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i))
const SIGNATURE = Uint8Array.from({ length: 65 }, (_, i) => (i === 64 ? 1 : i))
const VALID_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)

let keys: Key[]
const deriveFromSeed = vi.fn(
    async (parentId: string, path: string, opts?: DeriveOptions) => {
        keys = [
            ...keys,
            {
                id: opts!.id!,
                type: SECP256K1_DERIVED_KEY_TYPE,
                algorithm: SECP256K1_KEY_ALGORITHM,
                extractable: false,
                publicKey: PUBLIC_KEY,
                metadata: {
                    storage: 'bytes',
                    parentKeyId: parentId,
                    path,
                    ...opts?.metadata,
                },
            },
        ]
        return opts!.id!
    },
)
const sealedPrivateKeys = new Map<string, Uint8Array>()
// The buffers `export` handed out, to check the core scrubs the keystore's copy.
let exportedBuffers: Uint8Array[] = []
const importKey = vi.fn(async (data: KeyData) => {
    sealedPrivateKeys.set(data.id, Uint8Array.from(data.privateKey ?? []))
    keys = [
        ...keys,
        {
            id: data.id,
            type: data.type,
            algorithm: data.algorithm,
            extractable: data.extractable,
            publicKey: PUBLIC_KEY,
            metadata: data.metadata,
        },
    ]
    return data.id
})
const sign = vi.fn(async () => Uint8Array.from(SIGNATURE))
const exportKey = vi.fn(async (id: string) => {
    const sealed = sealedPrivateKeys.get(id)
    const privateKey = sealed ? Uint8Array.from(sealed) : undefined
    if (privateKey) exportedBuffers.push(privateKey)
    return { id, privateKey }
})

const keyStore = () =>
    ({
        deriveFromSeed,
        import: importKey,
        sign,
        export: exportKey,
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

const isZero = (bytes: Uint8Array): boolean => bytes.every(b => b === 0)

const expectNoKeystoreCall = () => {
    expect(deriveFromSeed).not.toHaveBeenCalled()
    expect(importKey).not.toHaveBeenCalled()
    expect(sign).not.toHaveBeenCalled()
    expect(exportKey).not.toHaveBeenCalled()
}

const deriveFirst = (domain = SIGNING_ACCESS_DOMAIN, path = FIRST_PATH) =>
    makeCore().deriveSecp256k1Child(SEED_ID, { path, id: FIRST_ID }, domain)

describe('createKmsCore secp256k1', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        keys = [seedKey(), entropyKey()]
        sealedPrivateKeys.clear()
        exportedBuffers = []
    })

    describe('deriveSecp256k1Child', () => {
        test("derives from the seed's entropy and records the seed as parent", async () => {
            const child = await deriveFirst()

            expect(deriveFromSeed).toHaveBeenCalledWith(
                ENTROPY_ID,
                FIRST_PATH,
                {
                    algorithm: SECP256K1_KEY_ALGORITHM,
                    curve: 'secp256k1',
                    id: FIRST_ID,
                    metadata: { parentKeyId: SEED_ID },
                },
            )
            expect(child).toEqual({
                keyPairId: FIRST_ID,
                publicKey: PUBLIC_KEY,
            })
        })

        test('re-deriving the same id and path never reopens the entropy', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            const again = await deriveFirst()

            expect(again).toEqual({
                keyPairId: FIRST_ID,
                publicKey: PUBLIC_KEY,
            })
            expect(deriveFromSeed).not.toHaveBeenCalled()
        })

        test('the same id under another path is refused', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            await expect(
                deriveFirst(SIGNING_ACCESS_DOMAIN, "m/44'/60'/0'/0/1"),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expect(deriveFromSeed).not.toHaveBeenCalled()
        })

        test.each([SeedScheme.Algo25, SeedScheme.Quantum])(
            'refuses a %s seed before any keystore call',
            async scheme => {
                keys = [seedKey(scheme), entropyKey()]

                await expect(deriveFirst()).rejects.toBeInstanceOf(
                    KeyManagementError,
                )
                expectNoKeystoreCall()
            },
        )

        test('refuses an HD seed with no entropy secret', async () => {
            keys = [seedKey()]

            await expect(deriveFirst()).rejects.toBeInstanceOf(
                KeyManagementError,
            )
            expectNoKeystoreCall()
        })

        test('a foreign domain is refused before any keystore call', async () => {
            await expect(deriveFirst(FOREIGN_DOMAIN)).rejects.toBeInstanceOf(
                KeyAccessError,
            )
            expectNoKeystoreCall()
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
                expectNoKeystoreCall()
            },
        )

        test("decodes the keystore's r‖s‖yParity", async () => {
            await deriveFirst()
            const digest = new Uint8Array(32).fill(0xab)

            const signature = await makeCore().signSecp256k1Digest(
                FIRST_ID,
                digest,
                SIGNING_ACCESS_DOMAIN,
            )

            expect(sign).toHaveBeenCalledWith(FIRST_ID, digest)
            expect(signature).toEqual(decodeSecp256k1Signature(SIGNATURE))
        })

        test('a foreign domain is refused before the keystore signs', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().signSecp256k1Digest(
                    FIRST_ID,
                    new Uint8Array(32),
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(sign).not.toHaveBeenCalled()
        })

        test('a parentless imported key signs under the default ACL', async () => {
            await makeCore().importSecp256k1Key(
                Uint8Array.from(VALID_KEY),
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

            await expect(
                makeCore().signSecp256k1Digest(
                    'imported-1',
                    new Uint8Array(32),
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).resolves.toEqual(decodeSecp256k1Signature(SIGNATURE))
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
            ['all ones (above the curve order)', new Uint8Array(32).fill(0xff)],
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
                expectNoKeystoreCall()
                expect(isZero(key)).toBe(true)
            },
        )

        test('seals a valid key as extractable and zeroes the input', async () => {
            const input = Uint8Array.from(VALID_KEY)

            const imported = await makeCore().importSecp256k1Key(
                input,
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(imported).toEqual({
                keyPairId: 'imported-1',
                publicKey: PUBLIC_KEY,
            })
            expect(importKey).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'imported-1',
                    type: SECP256K1_IMPORTED_KEY_TYPE,
                    algorithm: SECP256K1_KEY_ALGORITHM,
                    extractable: true,
                }),
                'raw',
            )
            expect(isZero(input)).toBe(true)
        })

        test('an id that already holds an entry is refused and the input zeroed', async () => {
            await deriveFirst()
            vi.clearAllMocks()
            const input = Uint8Array.from(VALID_KEY)

            await expect(
                makeCore().importSecp256k1Key(
                    input,
                    { id: FIRST_ID },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expectNoKeystoreCall()
            expect(isZero(input)).toBe(true)
        })

        test('importing the same key again resolves to its entry without touching the keystore', async () => {
            await makeCore().importSecp256k1Key(
                Uint8Array.from(VALID_KEY),
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )
            vi.clearAllMocks()
            const again = Uint8Array.from(VALID_KEY)

            const imported = await makeCore().importSecp256k1Key(
                again,
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(imported).toEqual({
                keyPairId: 'imported-1',
                publicKey: PUBLIC_KEY,
            })
            expectNoKeystoreCall()
            expect(isZero(again)).toBe(true)
        })

        test('an imported entry under another parent is not the same key', async () => {
            await makeCore().importSecp256k1Key(
                Uint8Array.from(VALID_KEY),
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )
            vi.clearAllMocks()

            await expect(
                makeCore().importSecp256k1Key(
                    Uint8Array.from(VALID_KEY),
                    { id: 'imported-1', parentKeyId: SEED_ID },
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
            expectNoKeystoreCall()
        })

        test('a parentless import under a foreign domain is refused', async () => {
            const input = Uint8Array.from(VALID_KEY)

            await expect(
                makeCore().importSecp256k1Key(
                    input,
                    { id: 'imported-1' },
                    FOREIGN_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expectNoKeystoreCall()
            expect(isZero(input)).toBe(true)
        })
    })

    describe('exportSecp256k1Key', () => {
        const importFirst = () =>
            makeCore().importSecp256k1Key(
                Uint8Array.from(VALID_KEY),
                { id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

        test('returns the imported bytes and zeroes the keystore copy', async () => {
            await importFirst()

            const exported = await makeCore().exportSecp256k1Key(
                'imported-1',
                SIGNING_ACCESS_DOMAIN,
            )

            expect(exported).toEqual(Uint8Array.from(VALID_KEY))
            expect(exportedBuffers).toHaveLength(1)
            expect(isZero(exportedBuffers[0])).toBe(true)
        })

        test('never exports a derived child', async () => {
            await deriveFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().exportSecp256k1Key(FIRST_ID, SIGNING_ACCESS_DOMAIN),
            ).rejects.toBeInstanceOf(InvalidKeyError)
            expect(exportKey).not.toHaveBeenCalled()
        })

        test('refuses a foreign domain before the keystore is read', async () => {
            await importFirst()
            vi.clearAllMocks()

            await expect(
                makeCore().exportSecp256k1Key('imported-1', FOREIGN_DOMAIN),
            ).rejects.toBeInstanceOf(KeyAccessError)
            expect(exportKey).not.toHaveBeenCalled()
        })

        test('an entry the keystore holds no private key for is a keystore error', async () => {
            await importFirst()
            sealedPrivateKeys.clear()

            await expect(
                makeCore().exportSecp256k1Key(
                    'imported-1',
                    SIGNING_ACCESS_DOMAIN,
                ),
            ).rejects.toBeInstanceOf(KeyManagementError)
        })

        test('an unknown id is not found', async () => {
            await expect(
                makeCore().exportSecp256k1Key('missing', SIGNING_ACCESS_DOMAIN),
            ).rejects.toBeInstanceOf(KeyNotFoundError)
        })
    })

    describe('the chain-facing port', () => {
        test('deriveFromSeed with the secp256k1 scheme derives through the keystore branch', async () => {
            const derived = await makeCore().deriveFromSeed(
                SEED_ID,
                { scheme: 'secp256k1', path: FIRST_PATH, id: FIRST_ID },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(derived.publicKey).toEqual(PUBLIC_KEY)
            expect(deriveFromSeed).toHaveBeenCalledWith(
                ENTROPY_ID,
                FIRST_PATH,
                expect.objectContaining({ curve: 'secp256k1' }),
            )
        })

        test('importRawKey with the secp256k1 scheme seals the key', async () => {
            const input = Uint8Array.from(VALID_KEY)

            await makeCore().importRawKey(
                input,
                { scheme: 'secp256k1', id: 'imported-1' },
                SIGNING_ACCESS_DOMAIN,
            )

            expect(importKey).toHaveBeenCalledWith(
                expect.objectContaining({ type: SECP256K1_IMPORTED_KEY_TYPE }),
                'raw',
            )
            expect(isZero(input)).toBe(true)
        })

        test('sign on a secp256k1 key returns the 65-byte r‖s‖yParity', async () => {
            await deriveFirst()

            const bytes = await makeCore().sign(
                FIRST_ID,
                new Uint8Array(32),
                SIGNING_ACCESS_DOMAIN,
            )

            expect(bytes).toEqual(SIGNATURE)
        })
    })
})
