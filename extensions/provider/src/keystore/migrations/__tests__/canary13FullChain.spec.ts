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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base64 } from '@scure/base'
import {
    createSecretScratch,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'

// This spec lives one level shallower than the preflight/repairs specs
// (`migrations/__tests__/` vs `migrations/preflight/__tests__/`), so the walk
// to `node_modules` is four `../` segments, not five. See
// `preflight/__tests__/0004-adopt-material-less-records.spec.ts` for why the
// package root is mocked at all and why the prefixes/`serializeKey`/
// `MasterKeyNotFoundError` still come from its real dist while
// `sealData`/`openData`/`decode` cannot.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../__fixtures__/keystoreFormats')

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        MasterKeyNotFoundError: errors.MasterKeyNotFoundError,
        sealData: formats.sealData,
        openData: formats.openData,
        decode: formats.decode,
    }
})

import {
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    decode,
    openData,
    sealData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../__fixtures__/fakeStorage'
import {
    canary13DerivedChild,
    sealCanary13Record,
} from '../__fixtures__/keystoreFormats'
import { createDeclinedRegister } from '../declined'
import { preflightMigrations } from '../preflight'
import { repairsMigrations } from '../repairs'

const MASTER_KEY = new Uint8Array(32).fill(7)
// Non-uniform (not `.fill(...)`): a byte-reordering corruption of the
// migrated material — e.g. an accidental `.reverse()` — must be visible to
// the content assertions below. A uniform array is invariant under reversal
// and would let that corruption pass silently.
const ROOT_MATERIAL = Uint8Array.from({ length: 96 }, (_, i) => i)
const ALGO25_CHILD_MATERIAL = Uint8Array.from({ length: 64 }, (_, i) => i + 100)
const subtle = globalThis.crypto.subtle

/** Stands in for the migrations ledger's MMKV instance. */
let noteStore: Record<string, string>

const noteStoreApi = () => ({
    getString: (key: string) => noteStore[key],
    set: (key: string, value: string) => {
        noteStore[key] = value
    },
})

let masterKeyForRead: () => Promise<Uint8Array>

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead,
    declined: createDeclinedRegister(noteStoreApi()),
})

const utils = (revision: {
    module: string
    id: number
    name: string
}): MigrationUtils => ({
    revision,
    secrets: createSecretScratch().scratch,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
})

// Every record shape a real pre-upgrade (canary.13) device could hold: a
// top-level-material root, top-level-material entropy, an HD-derived child
// with no material of its own, an algo25 seed + its child, the PIN secret,
// and both a plain and a biometric-wrapped passkey credential.
const RECORDS: object[] = [
    {
        id: 'root-1',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: ROOT_MATERIAL,
        metadata: { scheme: 'bip39', name: 'Imported Seed' },
    },
    {
        id: 'entropy-1',
        type: 'secret-key',
        name: 'Secret',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: [],
        privateKey: new Uint8Array(32).fill(4),
        metadata: { parentKeyId: 'root-1', entropyKey: true },
    },
    canary13DerivedChild({
        id: 'child-1',
        parentKeyId: 'root-1',
        rootPrivateKey: ROOT_MATERIAL,
    }),
    {
        id: 'algo25-seed',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: new Uint8Array(32).fill(5),
        metadata: { scheme: 'algo25' },
    },
    {
        id: 'algo25-child',
        type: 'ed25519',
        name: 'Ed25519 Key',
        algorithm: 'EdDSA',
        format: 'raw',
        extractable: true,
        keyUsages: ['sign', 'verify'],
        publicKey: new Uint8Array(32).fill(6),
        privateKey: ALGO25_CHILD_MATERIAL,
        metadata: { parentKeyId: 'algo25-seed' },
    },
    {
        id: 'pera.pinCode',
        type: 'secret-key',
        name: 'Secret',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: [],
        privateKey: new Uint8Array(16).fill(8),
        metadata: {},
    },
    {
        id: 'cred-plain',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['sign'],
        publicKey: new Uint8Array(32).fill(2),
        privateKey: new Uint8Array(32).fill(3),
        metadata: { origin: 'https://example.com' },
    },
    {
        id: 'cred-wrapped',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['sign'],
        publicKey: new Uint8Array(32).fill(2),
        privateKeyEnc: { iv: 'aa', data: 'bb' },
        metadata: { origin: 'https://example.com' },
    },
]

describe('canary.13 full chain (preflight + repairs)', () => {
    let storage: FakeKeychainStorage

    beforeEach(async () => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY.slice())
        noteStore = {}
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        storage = fakeStorage({})
        for (const record of RECORDS) {
            storage.set(
                (record as { id: string }).id,
                await sealCanary13Record(subtle, MASTER_KEY, record),
            )
        }
    })

    const runPreflight = async (target: FakeKeychainStorage) => {
        for (const migration of preflightMigrations) {
            await migration.up(
                context(target),
                utils({
                    module: 'com.perawallet.wallet/keystore-preflight',
                    id: migration.id,
                    name: migration.name,
                }),
            )
        }
    }

    const runRepairs = async (target: FakeKeychainStorage) => {
        for (const migration of repairsMigrations) {
            await migration.up(
                context(target),
                utils({
                    module: 'com.perawallet.wallet/keystore-repairs',
                    id: migration.id,
                    name: migration.name,
                }),
            )
        }
    }

    const runChain = async (target: FakeKeychainStorage) => {
        await runPreflight(target)
        await runRepairs(target)
    }

    const metadataAt = (target: FakeKeychainStorage, id: string) =>
        decode(target.getString(METADATA_PREFIX + id) as string) as {
            type?: string
            format?: string
            metadata?: Record<string, unknown>
        }

    it('strands nothing after the whole chain runs', async () => {
        await runChain(storage)

        for (const id of [
            'root-1',
            'entropy-1',
            'algo25-seed',
            'algo25-child',
            'pera.pinCode',
        ]) {
            expect(storage.getString(METADATA_PREFIX + id)).toBeDefined()
            expect(storage.getString(MATERIAL_PREFIX + id)).toBeDefined()
            expect(storage.getString(id)).toBeUndefined()
        }

        // Presence isn't enough — a migration that moved every account to the
        // WRONG bytes would still pass every assertion above. Open the
        // sealed material and compare against what was actually seeded.
        expect(
            base64.decode(
                await openData(
                    subtle,
                    MASTER_KEY,
                    storage.getString(MATERIAL_PREFIX + 'root-1')!,
                ),
            ),
        ).toEqual(ROOT_MATERIAL)
        // `algo25-child` is an ed25519 signing key, not a raw blob like
        // `root-1` — somewhere in the chain its material is normalised into
        // a PKCS8 DER wrapper for WebCrypto import, so the opened bytes carry
        // a fixed-size ASN.1 header before the raw 32-byte key. Legacy 64-byte
        // ed25519 material is `seed(32) || publicKey(32)`, and only the seed
        // half survives normalisation — verified here rather than assumed by
        // using a non-uniform fixture where the two halves actually differ.
        expect(
            base64
                .decode(
                    await openData(
                        subtle,
                        MASTER_KEY,
                        storage.getString(MATERIAL_PREFIX + 'algo25-child')!,
                    ),
                )
                .slice(-32),
        ).toEqual(ALGO25_CHILD_MATERIAL.slice(0, 32))

        // Derived children carry no material of their own in the new layout.
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'child-1')).toBeUndefined()

        // Both native credential providers read passkeys at the bare id.
        expect(storage.getString('cred-plain')).toBeDefined()
        expect(
            storage.getString(METADATA_PREFIX + 'cred-plain'),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + 'cred-plain'),
        ).toBeUndefined()
        expect(storage.getString('cred-wrapped')).toBeDefined()
        expect(
            storage.getString(METADATA_PREFIX + 'cred-wrapped'),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + 'cred-wrapped'),
        ).toBeUndefined()
    })

    // A device that ran 7.0.4 carries `preflight: 4` AND `repairs: 3` in its
    // ledger — `69dc9af4e` shipped both modules in one merge — so only
    // `preflight: 5` is pending on it and `repairs/0001`, until this fix the
    // only caller of `normalizeCanary13Record`, can never run again. Every
    // other test in this file runs both modules, i.e. a fresh ledger, which is
    // exactly why adoption in canary.13's vocabulary passed every gate:
    // records visible, migration ledgered, keystore reported healthy, and the
    // accounts still unusable.
    it('normalises adopted records into canary.19 vocabulary with the repairs module skipped (a partially-ledgered 7.0.4 device)', async () => {
        await runPreflight(storage)

        // `deriveFromSeed` rejects any parent not typed `hd-root-key`
        // (`keystore-core/dist/create.js:723`): left as `seed`, Add Account
        // stays inert (PERA-4915).
        expect(metadataAt(storage, 'root-1').type).toBe('hd-root-key')

        // An ed25519 child kept at `format: 'raw'` over 64 raw libsodium bytes
        // with no `signAlgorithm` throws inside the host `importKey`
        // (`create.js:879-891`): the account cannot sign (PERA-4917).
        const child = metadataAt(storage, 'algo25-child')
        expect(child.format).toBe('pkcs8')
        expect(child.metadata?.signAlgorithm).toEqual({ name: 'Ed25519' })
        expect(
            base64
                .decode(
                    await openData(
                        subtle,
                        MASTER_KEY,
                        storage.getString(MATERIAL_PREFIX + 'algo25-child')!,
                    ),
                )
                .slice(-32),
        ).toEqual(ALGO25_CHILD_MATERIAL.slice(0, 32))

        const derived = metadataAt(storage, 'child-1')
        expect(derived.metadata?.storage).toBe('none')
        expect(derived.metadata?.parentKeyId).toBe('root-1')

        for (const id of [
            'root-1',
            'entropy-1',
            'child-1',
            'algo25-seed',
            'algo25-child',
            'pera.pinCode',
        ]) {
            expect(storage.getString(id)).toBeUndefined()
        }
    })

    it('is a no-op on a second run', async () => {
        await runChain(storage)
        const after = storage.entries()

        await runChain(storage)

        expect(storage.entries()).toEqual(after)
    })

    // Neither test above starts from an ALREADY-damaged store: both seed
    // every record bare and let the chain do 100% of the transformation.
    // Real devices are not all bare — a device that already ledgered the
    // shipped `0004` (before this branch's fix) has a biometric-wrapped
    // passkey stuck under the metadata prefix alone (0004's material-less
    // path never wrote a material entry), and a device whose passkey the
    // real, unmocked upstream package already split has one fully at
    // `k/`+`m/`. Both are "the exact state this chain exists to repair," and
    // mutation-testing found both restore paths were dead in this file:
    // neutering `restoreWrappedPasskeys` (`adopt/strandedRecords.ts`, reached
    // via preflight `0005`) or `repairs/0002-rematerialize-passkey-
    // credentials` left every test above green, because nothing here ever
    // started a run already in either damaged shape.

    // Mirrors `repairs/0002`'s own `seededCredential` fixture shape — a
    // plain passkey the real upstream package already split into `k/`+`m/`
    // with its raw material lifted. This is `repairs/0002`'s restore path,
    // not `restoreWrappedPasskeys`'s: `restoreWrappedPasskeys` explicitly
    // refuses (declines, does not restore) any `privateKeyEnc` record that
    // also has a `MATERIAL_PREFIX` entry — a passkey's material and its
    // biometric wrapper never coexist in this system — so this shape can
    // only be a plain credential's split, never a wrapped one's.
    it('restores an already-split plain passkey credential from a pre-existing k/+m/ pair', async () => {
        const damaged = fakeStorage({})
        const publicKey = new Uint8Array(32).fill(2)
        const privateKey = new Uint8Array(32).fill(3)

        damaged.set(
            METADATA_PREFIX + 'cred-plain-legacy',
            serializeKey({
                id: 'cred-plain-legacy',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                publicKey,
                metadata: { origin: 'https://example.com' },
            } as unknown as Parameters<typeof serializeKey>[0]),
        )
        damaged.set(
            MATERIAL_PREFIX + 'cred-plain-legacy',
            await sealData(subtle, MASTER_KEY, base64.encode(privateKey)),
        )

        await runChain(damaged)

        expect(damaged.getString('cred-plain-legacy')).toBeDefined()
        expect(
            damaged.getString(METADATA_PREFIX + 'cred-plain-legacy'),
        ).toBeUndefined()
        expect(
            damaged.getString(MATERIAL_PREFIX + 'cred-plain-legacy'),
        ).toBeUndefined()
    })

    // The shape the SHIPPED (pre-fix) `0004` actually produced on a real
    // device: a biometric-wrapped credential moved whole into `k/`, with no
    // `m/` entry (0004's material-less path never writes one). This is the
    // one shape `restoreWrappedPasskeys` itself restores.
    it('restores an already-adopted biometric-wrapped passkey from a k/-only record left by the shipped 0004', async () => {
        const damaged = fakeStorage({})

        damaged.set(
            METADATA_PREFIX + 'cred-wrapped-legacy',
            serializeKey({
                id: 'cred-wrapped-legacy',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                publicKey: new Uint8Array(32).fill(2),
                privateKeyEnc: { iv: 'aa', data: 'bb' },
                metadata: { origin: 'https://example.com' },
            } as unknown as Parameters<typeof serializeKey>[0]),
        )

        await runChain(damaged)

        expect(damaged.getString('cred-wrapped-legacy')).toBeDefined()
        expect(
            damaged.getString(METADATA_PREFIX + 'cred-wrapped-legacy'),
        ).toBeUndefined()
        expect(
            damaged.getString(MATERIAL_PREFIX + 'cred-wrapped-legacy'),
        ).toBeUndefined()
    })
})
