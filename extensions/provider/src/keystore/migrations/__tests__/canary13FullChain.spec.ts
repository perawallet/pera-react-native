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
const ROOT_MATERIAL = Uint8Array.from({ length: 96 }, (_, i) => i)
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
// top-level-material root and entropy, an HD-derived child with no material of
// its own, an algo25 seed + its signing child, the PIN secret, and both a
// plain and a biometric-wrapped passkey credential. Only the derived child is
// adopted by preflight; every top-level-material record is upstream's
// `adopt-flat-records`' job (revived by the subtle fix — see
// `__tests__/keystoreSubtleWiring.spec.ts` and on-device verification), which
// this harness cannot run because the real package is mocked. What this spec
// proves is that preflight+repairs adopt the child, normalise it, and leave
// everything else PRISTINE for upstream.
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
        privateKey: Uint8Array.from({ length: 64 }, (_, i) => i + 100),
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

// Records preflight must NOT adopt: they carry top-level material and belong to
// upstream, or are passkeys the native providers read at their bare id.
const LEFT_FLAT = [
    'root-1',
    'entropy-1',
    'algo25-seed',
    'algo25-child',
    'pera.pinCode',
    'cred-plain',
    'cred-wrapped',
]

// "Chain" here is preflight + repairs only. Upstream's own `adopt-flat-records`
// (which claims every top-level-material record) cannot run — the real
// `@algorandfoundation/react-native-keystore` is mocked — so this spec proves
// preflight adopts+normalises the derived child and leaves everything else
// pristine for upstream, NOT that the top-level records are ultimately adopted.
// That half is covered by `__tests__/keystoreSubtleWiring.spec.ts` plus
// on-device verification.
describe('canary.13 migration chain (preflight + repairs; upstream mocked)', () => {
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

    it('adopts the nested-only child and leaves every top-level-material record for upstream', async () => {
        const flatBefore = Object.fromEntries(
            LEFT_FLAT.map(id => [id, storage.getString(id)]),
        )

        await runChain(storage)

        // The nested-only HD child is adopted as a metadata-only `k/` entry,
        // normalised into canary.19's vocabulary. No `m/` — canary.19 derives
        // it from the parent on demand.
        expect(storage.getString('child-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'child-1')).toBeUndefined()
        const child = metadataAt(storage, 'child-1')
        expect(child.metadata?.storage).toBe('none')
        expect(child.metadata?.parentKeyId).toBe('root-1')
        // XHD signing reads `metadata.bip44Path`; canary.13 stored the raw
        // `derivationPath` string, so a child adopted without rewriting it
        // renders but cannot sign (PERA-4917).
        expect(child.metadata?.bip44Path).toEqual([
            0x8000_0000 + 44,
            0x8000_0000 + 283,
            0x8000_0000 + 0,
            0,
            0,
        ])
        // The nested root secret must never reach plaintext `k/`.
        expect(child.metadata).not.toHaveProperty('rootKey')

        // Every top-level-material record and every passkey is left exactly as
        // seeded — byte-identical — at its bare id, with no `k/`/`m/` written.
        // Adopting these is upstream's job; preflight must not mangle or
        // half-adopt them ahead of it.
        for (const id of LEFT_FLAT) {
            expect(storage.getString(id)).toBe(flatBefore[id])
            expect(storage.getString(METADATA_PREFIX + id)).toBeUndefined()
            expect(storage.getString(MATERIAL_PREFIX + id)).toBeUndefined()
        }
    })

    // A device that ran 7.0.4 carries `preflight: 4` AND `repairs: 3` in its
    // ledger — `69dc9af4e` shipped both modules in one merge — so a plain app
    // update re-runs neither. The dev "Keystore Migrations" tool resets the
    // modules, but even a preflight-only re-run must land a USABLE child: the
    // adoption normalises inline rather than leaning on `repairs/0001`, so the
    // child signs whether or not repairs re-runs alongside it.
    it('normalises the adopted child even with the repairs module skipped', async () => {
        await runPreflight(storage)

        const child = metadataAt(storage, 'child-1')
        expect(child.metadata?.storage).toBe('none')
        expect(child.metadata?.parentKeyId).toBe('root-1')
        expect(child.metadata?.bip44Path).toEqual([
            0x8000_0000 + 44,
            0x8000_0000 + 283,
            0x8000_0000 + 0,
            0,
            0,
        ])
    })

    it('is a no-op on a second run', async () => {
        await runChain(storage)
        const after = storage.entries()

        await runChain(storage)

        expect(storage.entries()).toEqual(after)
    })

    it('declines the child, keeping the nested root, when the parent is absent', async () => {
        const orphan = fakeStorage({})
        orphan.set(
            'child-1',
            await sealCanary13Record(
                subtle,
                MASTER_KEY,
                canary13DerivedChild({
                    id: 'child-1',
                    parentKeyId: 'missing-root',
                    rootPrivateKey: ROOT_MATERIAL,
                }),
            ),
        )

        await runChain(orphan)

        // The nested copy is the wallet's only surviving root material; the
        // chain must leave it flat rather than drop it.
        expect(orphan.getString('child-1')).toBeDefined()
        expect(orphan.getString(METADATA_PREFIX + 'child-1')).toBeUndefined()
    })
})
