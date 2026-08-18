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
})
