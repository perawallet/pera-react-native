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

// See 0002-lift-nested-material.spec.ts for why the package root is mocked and
// why the prefixes and `serializeKey` still come from its real dist while
// `sealData`/`openData`/`decode` cannot.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../../__fixtures__/keystoreFormats')

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
    MasterKeyNotFoundError,
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import {
    canary13DerivedChild,
    openData,
    sealCanary13Record,
} from '../../__fixtures__/keystoreFormats'
import { adoptStrandedRecords, hasStrandedWork } from '../strandedRecords'
// Deep relative import, not a package specifier — see
// `migrations/__tests__/nativeCredentialRecord.spec.ts` for why: it creates no
// `package.json` edge, so it never enters turbo's build graph the way a
// `@perawallet/wallet-core-passkeys` devDependency did. Round-1 review found
// every passkey-restore fixture here omitted `publicKey`, which is exactly
// why the format defects (tagless envelope, `JSON.stringify`-mangled bytes)
// went uncaught — this import lets the tests below prove the restored record
// round-trips through the REAL provider reader, not just this package's own
// mocked primitives.
import { openNativeProviderRecord } from '../../../../../../../packages/passkeys/src/native/nativeProviderRecord'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

let storage: FakeKeychainStorage

const deps = () => ({
    storage,
    subtle,
    masterKeyForRead: async () => MASTER_KEY,
})

const seed = async (record: object) => {
    storage.set(
        (record as { id: string }).id,
        await sealCanary13Record(subtle, MASTER_KEY, record),
    )
}

const holdsSameMaterialForTest = async (id: string, bytes: Uint8Array) => {
    const sealed = storage.getString(MATERIAL_PREFIX + id)
    if (sealed === undefined) return false
    return (await openData(subtle, MASTER_KEY, sealed)) === base64.encode(bytes)
}

beforeEach(() => {
    storage = fakeStorage()
})

describe('adoptStrandedRecords — material-bearing records', () => {
    const root = {
        id: 'root-1',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: new Uint8Array(96).fill(9),
        metadata: { scheme: 'bip39' },
    }

    it('splits a seed into k/ and m/ and removes the bare id', async () => {
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual(['root-1'])
        expect(storage.getString('root-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeDefined()
        expect(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1') as string,
            ),
        ).toBeDefined()
    })

    it('never writes material into the plaintext bucket', async () => {
        await seed(root)

        await adoptStrandedRecords(deps())

        expect(storage.getString(METADATA_PREFIX + 'root-1')).not.toContain(
            'privateKey',
        )
    })

    it('drops the stale bare copy when an identical pair already exists', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(storage.getString('root-1')).toBeUndefined()
    })

    it('quarantines under -legacy when a different key already holds the id, keeping both keys distinct and converging', async () => {
        const first = new Uint8Array(96).fill(1)
        const second = new Uint8Array(96).fill(2)
        await seed({ ...root, privateKey: first })
        await adoptStrandedRecords(deps())
        await seed({ ...root, privateKey: second })

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([
            { id: 'root-1', legacyId: 'root-1-legacy' },
        ])

        // Byte-level: the live id must still hold the FIRST key, and the
        // legacy id must hold the SECOND — a swap here would mean signing
        // with the wrong key (Critical 1/2).
        const liveMaterial = base64.decode(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1') as string,
            ),
        )
        const legacyMaterial = base64.decode(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1-legacy') as string,
            ),
        )
        expect(liveMaterial).toEqual(first)
        expect(legacyMaterial).toEqual(second)

        // The legacy metadata record must self-identify as the legacy id, not
        // the live one — writing "id": "root-1" there would make
        // `getMaterial`/`migrateLegacyPasskeys` resolve it back onto the live
        // key (Critical 1).
        const legacyMeta = JSON.parse(
            storage.getString(METADATA_PREFIX + 'root-1-legacy') as string,
        ) as { id: string }
        expect(legacyMeta.id).toBe('root-1-legacy')

        // Converges: the bare copy is gone, so a later launch does not
        // re-quarantine into the same occupied `-legacy` id (Important 3).
        expect(storage.getString('root-1')).toBeUndefined()
        expect(hasStrandedWork(storage)).toBe(false)
    })

    it('reports work only while bare candidates remain', async () => {
        await seed(root)
        expect(hasStrandedWork(storage)).toBe(true)

        await adoptStrandedRecords(deps())
        expect(hasStrandedWork(storage)).toBe(false)
    })

    it('stops reporting work for ids a pass decided belong at the bare id', async () => {
        await seed({
            id: 'cred-2',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            privateKeyEnc: { iv: 'aa', data: 'bb' },
        })

        const result = await adoptStrandedRecords(deps())

        expect(hasStrandedWork(storage)).toBe(true)
        expect(hasStrandedWork(storage, new Set(result.leftFlat))).toBe(false)
    })

    it('completes a half-written pair rather than quarantining it', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        storage.remove(METADATA_PREFIX + 'root-1')
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeDefined()
        expect(storage.getString('root-1')).toBeUndefined()
    })

    it('leaves an unreadable m/<id> and the bare record untouched, reporting failed (Critical 2)', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        storage.set(MATERIAL_PREFIX + 'root-1', 'not-a-sealed-blob')
        await seed(root)
        const metaBefore = storage.getString(METADATA_PREFIX + 'root-1')

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(result.adopted).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        // Nothing touched: the corrupt blob, the existing metadata and the
        // bare copy all survive exactly as they were.
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBe(
            'not-a-sealed-blob',
        )
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBe(metaBefore)
        expect(storage.getString('root-1')).toBeDefined()
    })

    it('refuses to merge under a foreign k/<id> when m/<id> is absent (Important 4)', async () => {
        const foreignMeta = JSON.stringify({
            id: 'root-1',
            type: 'seed',
            algorithm: 'raw',
            format: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            metadata: { scheme: 'foreign' },
        })
        storage.set(METADATA_PREFIX + 'root-1', foreignMeta)
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBe(foreignMeta)
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString('root-1')).toBeDefined()
    })

    it('refuses a record carrying both top-level and nested material, leaking nothing into k/ (Important 5)', async () => {
        const rootPrivateKey = new Uint8Array(96).fill(3)
        const combined = {
            ...root,
            privateKey: new Uint8Array(96).fill(4),
            metadata: {
                scheme: 'bip39',
                rootKey: {
                    id: 'parent-1',
                    type: 'hd-root-key',
                    privateKey: rootPrivateKey,
                },
            },
        }
        await seed(combined)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('rolls back and leaves the bare record intact when a write throws mid-adoption', async () => {
        await seed(root)
        const originalSet = storage.set.bind(storage)
        vi.spyOn(storage, 'set').mockImplementation((key, value) => {
            if (key === METADATA_PREFIX + 'root-1') {
                throw new Error('simulated MMKV write failure')
            }
            originalSet(key, value)
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('never throws when the master key is unavailable, and leaves candidates untouched', async () => {
        await seed(root)

        await expect(
            adoptStrandedRecords({
                storage,
                subtle,
                masterKeyForRead: async () => {
                    throw new MasterKeyNotFoundError()
                },
            }),
        ).resolves.toEqual(
            expect.objectContaining({
                adopted: [],
                quarantined: [],
                failed: [],
            }),
        )
        expect(storage.getString('root-1')).toBeDefined()
    })

    it('adoption path: catches a metadata write that silently succeeds but reads back as garbage (Minor 7 — load-bearing)', async () => {
        await seed(root)
        const originalSet = storage.set.bind(storage)
        vi.spyOn(storage, 'set').mockImplementation((key, value) => {
            if (key === METADATA_PREFIX + 'root-1') {
                originalSet(key, 'not-valid-json{')
                return
            }
            originalSet(key, value)
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        // The write "succeeded" (no throw), so only the readback/parse check
        // catches it. Deleting that check would leave this suite green while
        // the bare copy — the only other place the data lived — is gone.
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('quarantine path: rolls back an orphaned m/<id>-legacy when the legacy metadata write throws (Important 6 — load-bearing)', async () => {
        const first = new Uint8Array(96).fill(1)
        const second = new Uint8Array(96).fill(2)
        await seed({ ...root, privateKey: first })
        await adoptStrandedRecords(deps())
        await seed({ ...root, privateKey: second })

        const originalSet = storage.set.bind(storage)
        vi.spyOn(storage, 'set').mockImplementation((key, value) => {
            if (key === METADATA_PREFIX + 'root-1-legacy') {
                throw new Error('simulated MMKV write failure')
            }
            originalSet(key, value)
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        // Without `journal.track(MATERIAL_PREFIX + legacyId)` the material
        // sealed just before the throw is never rolled back, orphaning a
        // verified `m/` entry with no `k/` record pointing at it.
        expect(
            storage.getString(MATERIAL_PREFIX + 'root-1-legacy'),
        ).toBeUndefined()
        expect(
            storage.getString(METADATA_PREFIX + 'root-1-legacy'),
        ).toBeUndefined()
        expect(storage.getString('root-1')).toBeDefined()
        // The live pair must be completely unaffected by the failed
        // quarantine attempt.
        const liveMaterial = base64.decode(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1') as string,
            ),
        )
        expect(liveMaterial).toEqual(first)
    })

    it('quarantine path: catches a legacy metadata write that silently succeeds but reads back as garbage (NEW-1)', async () => {
        const first = new Uint8Array(96).fill(1)
        const second = new Uint8Array(96).fill(2)
        await seed({ ...root, privateKey: first })
        await adoptStrandedRecords(deps())
        await seed({ ...root, privateKey: second })

        const originalSet = storage.set.bind(storage)
        vi.spyOn(storage, 'set').mockImplementation((key, value) => {
            if (key === METADATA_PREFIX + 'root-1-legacy') {
                originalSet(key, 'not-valid-json{')
                return
            }
            originalSet(key, value)
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(
            storage.getString(MATERIAL_PREFIX + 'root-1-legacy'),
        ).toBeUndefined()
        expect(
            storage.getString(METADATA_PREFIX + 'root-1-legacy'),
        ).toBeUndefined()
        expect(storage.getString('root-1')).toBeDefined()
    })

    it('refuses to overwrite a third key already occupying -legacy, touching nothing (NEW-2)', async () => {
        const first = new Uint8Array(96).fill(1)
        const second = new Uint8Array(96).fill(2)
        const third = new Uint8Array(96).fill(3)

        await seed({ ...root, privateKey: first })
        await adoptStrandedRecords(deps())
        await seed({ ...root, privateKey: second })
        const firstQuarantine = await adoptStrandedRecords(deps())
        expect(firstQuarantine.quarantined).toEqual([
            { id: 'root-1', legacyId: 'root-1-legacy' },
        ])

        // A third bare record lands on the live id, colliding with BOTH the
        // live key (first) and the already-quarantined legacy key (second).
        await seed({ ...root, privateKey: third })

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(result.adopted).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        // Nothing was invented (no `-legacy-2`) and nothing was destroyed:
        // the live pair and the existing legacy pair are both untouched, and
        // the third bare record survives for a human to look at.
        const liveMaterial = base64.decode(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1') as string,
            ),
        )
        const legacyMaterial = base64.decode(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1-legacy') as string,
            ),
        )
        expect(liveMaterial).toEqual(first)
        expect(legacyMaterial).toEqual(second)
        expect(storage.getString('root-1')).toBeDefined()
    })

    it('refuses to delete the bare record when the existing k/<id> describes a different record, even though m/<id> already matches', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        const foreignMeta = JSON.stringify({
            id: 'root-1',
            type: 'seed',
            algorithm: 'raw',
            format: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            metadata: { scheme: 'foreign' },
        })
        storage.set(METADATA_PREFIX + 'root-1', foreignMeta)
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(result.quarantined).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        // `hasMeta` alone said this was safe to drop — only the content
        // check catches a `k/<id>` that exists but describes something else.
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBe(foreignMeta)
    })

    it('refuses a record carrying a top-level key alongside privateKey rather than destroying the key bytes', async () => {
        const EXTRA_KEY = new Uint8Array(32).fill(6)
        await seed({ ...root, key: EXTRA_KEY })

        const result = await adoptStrandedRecords(deps())

        // Before this fix, `own` (privateKey) got sealed, `metadataOf`
        // stripped `key` out of `k/`, and the bare record — the only other
        // place `key`'s bytes lived — was removed: a silent, permanent loss.
        // Refusing must leave the bare record as the ONLY copy, untouched.
        expect(result.adopted).not.toContain('root-1')
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('refuses a record carrying a non-Uint8Array key container alongside privateKey', async () => {
        // The gate must key off PRESENCE (a field name `metadataOf` would
        // strip), not `instanceof Uint8Array` — a wrapped/nested `key` still
        // gets stripped from `k/` by name and then lost when the bare copy
        // is removed, exactly like a bare `Uint8Array` would be.
        await seed({ ...root, key: { d: new Uint8Array(32).fill(6) } })

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).not.toContain('root-1')
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'root-1' }),
        ])
        expect(storage.getString('root-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })
})

describe('adoptStrandedRecords — nested-only children', () => {
    const ROOT_MATERIAL = new Uint8Array(96).fill(9)

    const root = {
        id: 'root-1',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: ROOT_MATERIAL,
        metadata: { scheme: 'bip39' },
    }

    it('writes metadata-only k/ and no m/ when the parent survives', async () => {
        await seed(root)
        await seed(
            canary13DerivedChild({
                id: 'child-1',
                parentKeyId: 'root-1',
                rootPrivateKey: ROOT_MATERIAL,
            }),
        )

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toContain('child-1')
        expect(storage.getString('child-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'child-1')).toBeUndefined()
    })

    it('strips the duplicated root secret out of the plaintext bucket', async () => {
        await seed(root)
        await seed(
            canary13DerivedChild({
                id: 'child-1',
                parentKeyId: 'root-1',
                rootPrivateKey: ROOT_MATERIAL,
            }),
        )

        await adoptStrandedRecords(deps())

        // A field-name check (`not.toContain('rootKey')`) would still pass if
        // the bytes leaked under a different key name — assert the actual
        // secret bytes never appear in the plaintext bucket.
        expect(storage.getString(METADATA_PREFIX + 'child-1')).not.toContain(
            base64.encode(ROOT_MATERIAL),
        )
    })

    it('repoints a child at the quarantined root its nested copy matches', async () => {
        // A replacement root already owns `root-1`; the original was quarantined.
        await seed({ ...root, privateKey: new Uint8Array(96).fill(4) })
        await adoptStrandedRecords(deps())
        await seed(root)
        await adoptStrandedRecords(deps())
        await seed(
            canary13DerivedChild({
                id: 'child-1',
                parentKeyId: 'root-1',
                rootPrivateKey: ROOT_MATERIAL,
            }),
        )

        await adoptStrandedRecords(deps())

        expect(storage.getString(METADATA_PREFIX + 'child-1')).toContain(
            'root-1-legacy',
        )
    })

    it('reconstructs the root from the child when no parent exists', async () => {
        await seed(
            canary13DerivedChild({
                id: 'child-1',
                parentKeyId: 'root-1',
                rootPrivateKey: ROOT_MATERIAL,
            }),
        )

        const result = await adoptStrandedRecords(deps())

        expect(result.reconstructed).toEqual(['root-1'])
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeDefined()
        expect(await holdsSameMaterialForTest('root-1', ROOT_MATERIAL)).toBe(
            true,
        )
    })

    it('refuses a nested child whose rootKey has no id, leaving it flat rather than discarding the last copy of the root', async () => {
        const child = canary13DerivedChild({
            id: 'child-1',
            parentKeyId: 'root-1',
            rootPrivateKey: ROOT_MATERIAL,
        }) as unknown as { metadata: { rootKey: { id?: string } } }
        delete child.metadata.rootKey.id

        await seed(child)

        const result = await adoptStrandedRecords(deps())

        expect(storage.getString('child-1')).toBeDefined()
        expect(result.adopted).not.toContain('child-1')
        expect(result.reconstructed).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'child-1' }),
        ])
    })

    it('refuses a nested child whose material sits at rootKey.seed rather than rootKey.privateKey', async () => {
        const child = canary13DerivedChild({
            id: 'child-1',
            parentKeyId: 'root-1',
            rootPrivateKey: ROOT_MATERIAL,
        }) as unknown as {
            metadata: {
                rootKey: { privateKey?: Uint8Array; seed?: Uint8Array }
            }
        }
        child.metadata.rootKey.seed = child.metadata.rootKey.privateKey
        delete child.metadata.rootKey.privateKey

        await seed(child)

        const result = await adoptStrandedRecords(deps())

        expect(storage.getString('child-1')).toBeDefined()
        expect(result.adopted).not.toContain('child-1')
        expect(result.reconstructed).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'child-1' }),
        ])
    })

    it('refuses a nested child carrying a top-level key container rather than discarding its bytes', async () => {
        // The shape check only counts what `liftSecrets` LIFTS, and
        // `liftSecrets` walks past a `SECRET_FIELDS` name holding anything but
        // a bare `Uint8Array`. `metadataOf` strips that name from `k/` anyway,
        // and the bare record — the only other place those bytes live — is
        // then removed. Presence by name, exactly as the material branch
        // gates, is what keeps the two branches from drifting apart again.
        await seed({
            ...canary13DerivedChild({
                id: 'child-1',
                parentKeyId: 'root-1',
                rootPrivateKey: ROOT_MATERIAL,
            }),
            key: { d: new Uint8Array(32).fill(6) },
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).not.toContain('child-1')
        expect(result.reconstructed).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'child-1' }),
        ])
        expect(storage.getString('child-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'child-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('refuses a nested child whose rootKey carries a container-shaped extra secret', async () => {
        // Same defect one level down: `rootKey` is dropped wholesale from the
        // child's `k/`, and the reconstructed root's own metadata goes through
        // `metadataOf`, which strips `key` by name. Only `rootKey.privateKey`
        // is ever placed in a bucket, so any other `SECRET_FIELDS` name on
        // `rootKey` would vanish with the bare record.
        const child = canary13DerivedChild({
            id: 'child-1',
            parentKeyId: 'root-1',
            rootPrivateKey: ROOT_MATERIAL,
        }) as unknown as { metadata: { rootKey: Record<string, unknown> } }
        child.metadata.rootKey.key = { d: new Uint8Array(32).fill(6) }

        await seed(child)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).not.toContain('child-1')
        expect(result.reconstructed).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'child-1' }),
        ])
        expect(storage.getString('child-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeUndefined()
    })

    it('refuses a nested child whose rootKey buries a container-shaped secret deeper than its own top level', async () => {
        // `metadata.rootKey` is dropped WHOLESALE from the child's `k/` write,
        // so depth buys nothing: a secret-named container anywhere under it is
        // gone once the bare record is removed. A bare `Uint8Array` at the same
        // spot is caught by the shape check (`liftSecrets` finds it, making the
        // count 2); only the container shape reaches here.
        await seed(root)
        const child = canary13DerivedChild({
            id: 'child-1',
            parentKeyId: 'root-1',
            rootPrivateKey: ROOT_MATERIAL,
        }) as unknown as {
            metadata: { rootKey: { metadata: Record<string, unknown> } }
        }
        child.metadata.rootKey.metadata.key = { d: new Uint8Array(32).fill(6) }

        await seed(child)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).not.toContain('child-1')
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'child-1' }),
        ])
        expect(storage.getString('child-1')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeUndefined()
    })
})

describe('adoptStrandedRecords — passkey restore', () => {
    // 91 bytes, matching the real shape `nativeProviderRecord.spec.ts` pins —
    // round-1's fixtures all omitted `publicKey`, which is exactly why the
    // tagless-envelope and JSON.stringify-mangled-bytes defects survived.
    const PUBLIC_KEY = new Uint8Array(91).fill(4)

    const wrappedCredential = (id: string) => ({
        id,
        type: 'hd-derived-p256',
        algorithm: 'P256',
        privateKeyEnc: { iv: 'aa', data: 'bb' },
        publicKey: PUBLIC_KEY,
        metadata: { origin: 'https://example.com' },
    })

    const seedInK = async (id: string, record: object) => {
        const { serializeKey } =
            await import('@algorandfoundation/react-native-keystore')
        storage.set(METADATA_PREFIX + id, serializeKey(record as never))
    }

    it('returns a 0004-moved wrapped credential to its bare id, readable by the real native provider reader', async () => {
        await seedInK('cred-1', wrappedCredential('cred-1'))

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual(['cred-1'])
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeUndefined()

        // The whole point: the native iOS/Android reader, not this package's
        // own mocked primitives, must be able to open it — with byte fields
        // as JSON number arrays (never `{$u8}`, never `JSON.stringify`'s
        // `{"0":4,…}`) and `privateKeyEnc` carried verbatim.
        const opened = (await openNativeProviderRecord(
            subtle,
            MASTER_KEY,
            storage.getString('cred-1') as string,
        )) as {
            id: string
            publicKey: number[]
            privateKeyEnc: { iv: string; data: string }
        }
        expect(opened.id).toBe('cred-1')
        expect(Array.isArray(opened.publicKey)).toBe(true)
        expect(opened.publicKey).toEqual(Array.from(PUBLIC_KEY))
        expect(opened.privateKeyEnc).toEqual({ iv: 'aa', data: 'bb' })
    })

    it('leaves a wrapped credential at its bare id untouched', async () => {
        await seed(wrappedCredential('cred-2'))

        const result = await adoptStrandedRecords(deps())

        expect(result.leftFlat).toContain('cred-2')
        expect(storage.getString('cred-2')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-2')).toBeUndefined()
    })

    it("restores using the storage key as id, never the record's own (possibly stale) id", async () => {
        await seedInK('cred-3', wrappedCredential('some-other-id'))

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual(['cred-3'])
        expect(storage.getString('some-other-id')).toBeUndefined()
        const opened = (await openNativeProviderRecord(
            subtle,
            MASTER_KEY,
            storage.getString('cred-3') as string,
        )) as { id: string }
        expect(opened.id).toBe('cred-3')
    })

    it('refuses to restore when m/<id> unexpectedly already holds material, touching nothing', async () => {
        await seedInK('cred-4', wrappedCredential('cred-4'))
        storage.set(MATERIAL_PREFIX + 'cred-4', 'unrelated-sealed-blob')

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'cred-4' }),
        ])
        expect(storage.getString('cred-4')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-4')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-4')).toBe(
            'unrelated-sealed-blob',
        )
    })

    it('refuses a record carrying privateKeyEnc alongside a top-level privateKey rather than corrupting it', async () => {
        // classifyRecord gives privateKeyEnc precedence over material, so
        // without this refusal a record carrying BOTH would be dragged to
        // the bare id with its real privateKey mangled by
        // toNativeByteArray/JSON round-tripping inside `...rest`.
        await seedInK('cred-6', {
            ...wrappedCredential('cred-6'),
            privateKey: new Uint8Array(32).fill(9),
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual([])
        expect(result.failed).toEqual([
            expect.objectContaining({ id: 'cred-6' }),
        ])
        // Untouched: still exactly where it was, at k/<id>, never dragged to
        // a bare id half-converted.
        expect(storage.getString('cred-6')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-6')).toBeDefined()
    })

    it('completes the resume state — a bare copy already exists alongside k/<id> — by removing k/<id> rather than refusing', async () => {
        // 0002's documented resume shape: an earlier run wrote and verified
        // the flat copy, then was killed before removing k/<id>. Refusing
        // here would mean a permanent `failed` entry and a master-key read
        // on every subsequent boot forever.
        await seedInK('cred-7', wrappedCredential('cred-7'))
        // A stale flat copy — content doesn't matter, only that reprocessing
        // overwrites it with a freshly proven-good write rather than leaving
        // it or refusing outright.
        storage.set('cred-7', 'stale-flat-copy-from-a-killed-run')

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual(['cred-7'])
        expect(storage.getString(METADATA_PREFIX + 'cred-7')).toBeUndefined()
        const opened = (await openNativeProviderRecord(
            subtle,
            MASTER_KEY,
            storage.getString('cred-7') as string,
        )) as { id: string }
        expect(opened.id).toBe('cred-7')
    })

    it('does not roll back the proven-good flat write when only the k/<id> removal fails — leaves it, records the incomplete removal', async () => {
        await seedInK('cred-5', wrappedCredential('cred-5'))
        const originalRemove = storage.remove.bind(storage)
        vi.spyOn(storage, 'remove').mockImplementation(key => {
            if (key === METADATA_PREFIX + 'cred-5') {
                throw new Error('simulated MMKV remove failure')
            }
            originalRemove(key)
        })

        const result = await adoptStrandedRecords(deps())

        // 0002's rule: a failure removing k/<id> must never undo a write
        // already proven correct by its own readback — doing so would leave
        // nothing readable at all.
        expect(result.restored).toEqual([])
        expect(result.failed).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'cred-5' })]),
        )
        expect(storage.getString('cred-5')).toBeDefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-5')).toBeDefined()
        const opened = (await openNativeProviderRecord(
            subtle,
            MASTER_KEY,
            storage.getString('cred-5') as string,
        )) as { id: string }
        expect(opened.id).toBe('cred-5')
    })

    it('rolls back the flat write when the write-and-verify phase itself fails, never leaving neither bucket nor a half-written flat copy', async () => {
        await seedInK('cred-8', wrappedCredential('cred-8'))
        const originalSet = storage.set.bind(storage)
        vi.spyOn(storage, 'set').mockImplementation((key, value) => {
            if (key === 'cred-8') {
                throw new Error('simulated MMKV write failure')
            }
            originalSet(key, value)
        })

        const result = await adoptStrandedRecords(deps())

        expect(result.restored).toEqual([])
        expect(result.failed).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'cred-8' })]),
        )
        expect(storage.getString('cred-8')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-8')).toBeDefined()
    })
})
