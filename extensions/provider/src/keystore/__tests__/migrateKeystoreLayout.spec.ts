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

import { webcrypto } from 'node:crypto'
import { base64, base64url } from '@scure/base'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyData } from '@algorandfoundation/keystore-core'
import {
    migrateKeystoreLayout,
    type KeystoreLayoutMigrationDeps,
} from '../migrateKeystoreLayout'

// The keystore package cannot be imported off device — it pulls in
// react-native-quick-crypto, whose entry point node cannot parse. These stand-ins
// re-implement the canary.13 and canary.14 formats read out of
// react-native-keystore's dist, over the same AES-256-GCM primitives. They pin
// the migration's behaviour and the metadata/material split; they cannot prove
// byte compatibility with upstream, which is what on-device verification is for.

const MASTER_KEY = new Uint8Array(32).fill(7)
const IV_LENGTH = 12
const GCM_TAG_LENGTH = 16

const importKey = (key: Uint8Array) =>
    webcrypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
    ])

/** canary.14 `sealData`: `{iv, content}`, tag inside `content`. */
const sealData = async (key: Uint8Array, data: string): Promise<string> => {
    const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = new Uint8Array(
        await webcrypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            await importKey(key),
            new TextEncoder().encode(data),
        ),
    )
    return JSON.stringify({
        iv: base64.encode(iv),
        content: base64.encode(ciphertext),
    })
}

/** canary.14 `openData`, including its legacy `{iv, tag, content}` branch. */
const openData = async (key: Uint8Array, payload: string): Promise<string> => {
    const { iv, tag, content } = JSON.parse(payload)
    const body = base64.decode(content)
    const ciphertext =
        typeof tag === 'string'
            ? new Uint8Array([...body, ...base64.decode(tag)])
            : body
    return new TextDecoder().decode(
        await webcrypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64.decode(iv) },
            await importKey(key),
            ciphertext,
        ),
    )
}

/** canary.14 `encode`: JSON with byte fields as `{ $u8: base64 }`. */
const encode = (key: unknown): string =>
    JSON.stringify(key, (_k, value) =>
        value instanceof Uint8Array ? { $u8: base64.encode(value) } : value,
    )

/** canary.14 `decode`, which accepts both its own and the canary.13 format. */
const decode = (data: string): KeyData => {
    if (data.startsWith('{')) {
        return JSON.parse(data, (_k, value) =>
            value && typeof value === 'object' && typeof value.$u8 === 'string'
                ? base64.decode(value.$u8)
                : value,
        )
    }
    return JSON.parse(
        new TextDecoder().decode(base64url.decode(data)),
        (key, value) =>
            (key.endsWith('Key') || key === 'seed') && Array.isArray(value)
                ? new Uint8Array(value)
                : value,
    )
}

/** canary.13 wrote the whole record under the bare id, tag in its own field. */
const writeCanary13Record = async (
    store: Map<string, string>,
    record: Partial<KeyData> & { id: string },
): Promise<void> => {
    const json = JSON.stringify(record, (_k, value) =>
        value instanceof Uint8Array ? Array.from(value) : value,
    )
    const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const sealed = new Uint8Array(
        await webcrypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            await importKey(MASTER_KEY),
            new TextEncoder().encode(
                base64url.encode(new TextEncoder().encode(json)),
            ),
        ),
    )
    store.set(
        record.id,
        JSON.stringify({
            iv: base64.encode(iv),
            content: base64.encode(sealed.slice(0, -GCM_TAG_LENGTH)),
            tag: base64.encode(sealed.slice(-GCM_TAG_LENGTH)),
        }),
    )
}

const algo25Record = (id: string) => ({
    id,
    type: 'ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    privateKey: new Uint8Array(32).fill(1),
    publicKey: new Uint8Array(32).fill(2),
    metadata: { fromMnemonic: true },
})

let store: Map<string, string>
let readMasterKey: ReturnType<typeof vi.fn>

const deps = (): KeystoreLayoutMigrationDeps => ({
    storage: {
        getAllKeys: () => [...store.keys()],
        getString: (key: string) => store.get(key),
        set: (key: string, value: string) => store.set(key, value),
        remove: (key: string) => {
            store.delete(key)
        },
    },
    readMasterKey: readMasterKey as () => Promise<Uint8Array>,
    openData,
    sealData,
    encode,
    decode,
})

describe('migrateKeystoreLayout', () => {
    beforeEach(() => {
        store = new Map()
        readMasterKey = vi.fn(async () => MASTER_KEY)
    })

    it('re-indexes a canary.13 record into the k/ and m/ buckets', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })
        expect(store.has('key-1')).toBe(false)
        expect(store.has('k/key-1')).toBe(true)
        expect(store.has('m/key-1')).toBe(true)
    })

    it('preserves the private key bytes through the re-seal', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))

        await migrateKeystoreLayout(deps())

        const recovered = await openData(MASTER_KEY, store.get('m/key-1')!)
        expect(base64.decode(recovered)).toEqual(new Uint8Array(32).fill(1))
    })

    // The k/ bucket is plaintext by design; material must not survive in it.
    it('strips the private key from the metadata bucket', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))

        await migrateKeystoreLayout(deps())

        const metadata = decode(store.get('k/key-1')!)
        expect(metadata.privateKey).toBeUndefined()
        expect(metadata).toMatchObject({
            id: 'key-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            metadata: { fromMnemonic: true },
        })
        expect(metadata.publicKey).toEqual(new Uint8Array(32).fill(2))
    })

    it('is a no-op once every record is already migrated', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))
        await migrateKeystoreLayout(deps())
        const after = new Map(store)

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 0, skipped: 0, failed: 0 })
        expect(store).toEqual(after)
    })

    // A run that wrote both buckets and died before the cleanup must not be
    // mistaken for a second key.
    it('drops a leftover canary.13 entry when the new buckets already exist', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))
        const legacy = store.get('key-1')!
        await migrateKeystoreLayout(deps())
        store.set('key-1', legacy)

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 })
        expect(store.has('key-1')).toBe(false)
    })

    it('leaves an undecryptable record in place rather than dropping it', async () => {
        store.set('key-1', JSON.stringify({ iv: 'AAAA', content: 'BBBB' }))

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 0, skipped: 0, failed: 1 })
        expect(store.has('key-1')).toBe(true)
        expect(store.has('k/key-1')).toBe(false)
    })

    // One unreadable record must not strand the rest of the wallet.
    it('migrates the remaining records when one fails', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))
        store.set('key-2', 'not-a-sealed-payload')
        await writeCanary13Record(store, algo25Record('key-3'))

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 2, skipped: 0, failed: 1 })
        expect(store.has('k/key-1')).toBe(true)
        expect(store.has('k/key-3')).toBe(true)
        expect(store.get('key-2')).toBe('not-a-sealed-payload')
    })

    // Watch-only records carry no material; a missing m/ entry is correct.
    it('migrates a record with no private key without writing a material entry', async () => {
        await writeCanary13Record(store, {
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })
        expect(store.has('m/watch-1')).toBe(false)
        expect(decode(store.get('k/watch-1')!).publicKey).toEqual(
            new Uint8Array(32).fill(3),
        )
    })

    // The k/ bucket is plaintext; an HD seed reaching it would sit unencrypted
    // on disk. canary.13's own commit() strips `seed` for exactly this reason.
    it('never writes a seed into the plaintext metadata bucket', async () => {
        await writeCanary13Record(store, {
            ...algo25Record('key-1'),
            seed: new Uint8Array(32).fill(9),
        } as Partial<KeyData> & { id: string })

        await migrateKeystoreLayout(deps())

        const metadata = store.get('k/key-1')!
        expect(metadata).not.toContain(
            base64.encode(new Uint8Array(32).fill(9)),
        )
        expect(decode(metadata)).not.toHaveProperty('seed')
    })

    // canary.13's importSeed stores the seed in `privateKey`, but a record
    // carrying only `seed` must still yield usable material, not a watch-only.
    it('seals a seed-only record as its material', async () => {
        await writeCanary13Record(store, {
            id: 'seed-1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            seed: new Uint8Array(32).fill(9),
        } as Partial<KeyData> & { id: string })

        const result = await migrateKeystoreLayout(deps())

        expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })
        const recovered = await openData(MASTER_KEY, store.get('m/seed-1')!)
        expect(base64.decode(recovered)).toEqual(new Uint8Array(32).fill(9))
    })

    // Observed on device: an HD-derived record embeds its parent under
    // `metadata.rootKey`, privateKey included. canary.13 sealed the whole
    // record so that was safe; k/ is plaintext, so it must not survive.
    it('strips key material nested inside metadata', async () => {
        const rootSecret = new Uint8Array(64).fill(11)
        await writeCanary13Record(store, {
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(4),
            metadata: {
                parentKeyId: 'root-1',
                rootKey: {
                    id: 'root-1',
                    type: 'hd-root-key',
                    privateKey: rootSecret,
                },
            },
        } as Partial<KeyData> & { id: string })

        await migrateKeystoreLayout(deps())

        const raw = store.get('k/derived-1')!
        expect(raw).not.toContain(base64.encode(rootSecret))
        const metadata = decode(raw) as KeyData & {
            metadata?: { rootKey?: Record<string, unknown> }
        }
        expect(metadata.metadata?.rootKey).not.toHaveProperty('privateKey')
        // Non-secret structure must survive so the record stays usable.
        expect(metadata.metadata?.rootKey).toMatchObject({
            id: 'root-1',
            type: 'hd-root-key',
        })
        expect(metadata.publicKey).toEqual(new Uint8Array(32).fill(4))
    })

    // Lifting material out of metadata must protect it, not discard it.
    it('seals material lifted out of metadata under the id that owns it', async () => {
        const rootSecret = new Uint8Array(64).fill(11)
        await writeCanary13Record(store, {
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: {
                rootKey: {
                    id: 'root-1',
                    type: 'hd-root-key',
                    privateKey: rootSecret,
                },
            },
        } as Partial<KeyData> & { id: string })

        await migrateKeystoreLayout(deps())

        const sealed = store.get('m/root-1')
        expect(sealed).toBeDefined()
        expect(base64.decode(await openData(MASTER_KEY, sealed!))).toEqual(
            rootSecret,
        )
    })

    // The record that owns an id is the authority on its material; an embedded
    // copy encountered later must never overwrite it.
    it('does not let an embedded copy overwrite an id’s own sealed material', async () => {
        const real = new Uint8Array(32).fill(1)
        const stale = new Uint8Array(64).fill(12)
        await writeCanary13Record(store, algo25Record('root-1'))
        await writeCanary13Record(store, {
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: { rootKey: { id: 'root-1', privateKey: stale } },
        } as Partial<KeyData> & { id: string })

        await migrateKeystoreLayout(deps())

        const sealed = await openData(MASTER_KEY, store.get('m/root-1')!)
        expect(base64.decode(sealed)).toEqual(real)
    })

    // A fresh install has no Keychain master key; reading one would throw.
    it('does not read the master key when there is nothing to migrate', async () => {
        store.set('k/key-1', JSON.stringify({ id: 'key-1' }))

        await migrateKeystoreLayout(deps())

        expect(readMasterKey).not.toHaveBeenCalled()
    })

    // Re-indexing alone is not enough: `sign` dispatches on `type` and reads
    // `metadata.signAlgorithm`, `format` and `metadata.bip44Path`. A record
    // that keeps canary.13's spelling decodes fine and then throws inside the
    // host `importKey` at signing time — a wallet that shows a balance it
    // cannot spend.
    describe('canary.14 record vocabulary', () => {
        const metadataOf = (id: string): KeyData =>
            decode(store.get(`k/${id}`)!)

        it('relabels a canary.13 falcon child to the canary.14 key type', async () => {
            await writeCanary13Record(store, {
                id: 'q-1',
                type: 'falcon1024',
                algorithm: 'raw',
                extractable: false,
                privateKey: new Uint8Array(64).fill(5),
                metadata: { parentKeyId: 'seed-q' },
            })

            await migrateKeystoreLayout(deps())

            expect(metadataOf('q-1')).toMatchObject({
                type: 'falcon-1024',
                algorithm: 'Falcon-1024',
            })
        })

        it('rewrites a raw ed25519 secret key as pkcs8 with a signAlgorithm', async () => {
            const seed = new Uint8Array(32).fill(1)
            await writeCanary13Record(store, {
                id: 'a-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'raw',
                extractable: false,
                // libsodium's 64-byte secret key: seed || public.
                privateKey: new Uint8Array([
                    ...seed,
                    ...new Uint8Array(32).fill(2),
                ]),
                metadata: { parentKeyId: 'seed-a' },
            })

            await migrateKeystoreLayout(deps())

            expect(metadataOf('a-1')).toMatchObject({
                format: 'pkcs8',
                metadata: {
                    signAlgorithm: { name: 'Ed25519' },
                    storage: 'bytes',
                },
            })
            const material = base64.decode(
                await openData(MASTER_KEY, store.get('m/a-1')!),
            )
            expect(material).toHaveLength(48)
            expect(material.slice(16)).toEqual(seed)
        })

        it('promotes a bip39 seed record to an hd-root-key', async () => {
            await writeCanary13Record(store, {
                id: 'r-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey: new Uint8Array(96).fill(3),
                metadata: { scheme: 'bip39' },
            })

            await migrateKeystoreLayout(deps())

            expect(metadataOf('r-1')).toMatchObject({
                type: 'hd-root-key',
                metadata: { scheme: 'bip39' },
            })
        })

        it('leaves algo25 and quantum seed records as seeds', async () => {
            await writeCanary13Record(store, {
                id: 's-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey: new Uint8Array(32).fill(6),
                metadata: { scheme: 'algo25' },
            })
            await writeCanary13Record(store, {
                id: 's-2',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey: new Uint8Array(32).fill(7),
                metadata: { scheme: 'quantum' },
            })

            await migrateKeystoreLayout(deps())

            expect(metadataOf('s-1').type).toBe('seed')
            expect(metadataOf('s-2').type).toBe('seed')
        })

        it('fills in bip44Path and derivationType for an hd-derived child', async () => {
            await writeCanary13Record(store, {
                id: 'd-1',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                publicKey: new Uint8Array(32).fill(7),
                metadata: {
                    path: "m/44'/283'/0'/0/0",
                    derivation: 9,
                    parentKeyId: 'r-1',
                },
            })

            await migrateKeystoreLayout(deps())

            expect(metadataOf('d-1').metadata).toMatchObject({
                bip44Path: [0x80_00_00_2c, 0x80_00_01_1b, 0x80_00_00_00, 0, 0],
                derivationType: 9,
                storage: 'none',
            })
        })
    })

    // The Android credential provider shares this MMKV instance and this master
    // key, but is a separate process still on the bare-id layout. Its records
    // are indistinguishable from canary.13 keystore entries by shape alone.
    describe('passkeys owned by the credential provider', () => {
        const passkeyRecord = (id: string) => ({
            id,
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            publicKey: new Uint8Array(33).fill(4),
            metadata: {
                origin: 'https://example.com',
                userHandle: 'dXNlcg',
                userId: 'user-1',
                count: 0,
            },
        })

        it('leaves the bare entry in place so the provider can still read it', async () => {
            await writeCanary13Record(store, passkeyRecord('cred-1'))

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 })
            expect(store.has('cred-1')).toBe(true)
            expect(store.has('k/cred-1')).toBe(false)
            expect(store.has('m/cred-1')).toBe(false)
        })

        // The provider's read path accepts this legacy type alongside the one it
        // writes, so a record left by an older build must be skipped too.
        it('also skips the legacy xhd-derived-p256 credential type', async () => {
            await writeCanary13Record(store, {
                ...passkeyRecord('cred-legacy'),
                type: 'xhd-derived-p256',
            })

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 })
            expect(store.has('cred-legacy')).toBe(true)
            expect(store.has('m/cred-legacy')).toBe(false)
        })

        it("still migrates the wallet's own records alongside one", async () => {
            await writeCanary13Record(store, passkeyRecord('cred-1'))
            await writeCanary13Record(store, algo25Record('key-1'))

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 1, skipped: 1, failed: 0 })
            expect(store.has('k/key-1')).toBe(true)
            expect(store.has('cred-1')).toBe(true)
        })

        // A dp256 key without the provider's origin/userHandle is ours.
        it('does not mistake a plain hd-derived-p256 key for a passkey', async () => {
            await writeCanary13Record(store, {
                id: 'p256-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                privateKey: new Uint8Array(32).fill(8),
                metadata: { parentKeyId: 'main-1' },
            })

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })
            expect(store.has('k/p256-1')).toBe(true)
        })
    })

    // The HD root is a wallet key, so unlike a credential it must migrate — but
    // `getHdRootSecret` reads it back at the bare id, and the canary.13 entry is
    // already in the format the provider parses. Deleting it leaves every
    // upgrading user able to authenticate and unable to create a new passkey.
    describe('the HD root the credential provider derives from', () => {
        const rootRecord = (id: string) => ({
            id,
            type: 'hd-root-key' as const,
            algorithm: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            privateKey: new Uint8Array(96).fill(5),
            metadata: { scheme: 'bip39' },
        })

        it('migrates it into k/ and m/ but keeps the bare entry as the provider shadow', async () => {
            await writeCanary13Record(store, rootRecord('root-1'))

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 })
            expect(store.has('k/root-1')).toBe(true)
            expect(store.has('m/root-1')).toBe(true)
            expect(store.has('root-1')).toBe(true)
        })

        it('keeps the shadow across repeated runs rather than dropping it as a leftover', async () => {
            await writeCanary13Record(store, rootRecord('root-1'))
            await migrateKeystoreLayout(deps())

            const result = await migrateKeystoreLayout(deps())

            expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 })
            expect(store.has('root-1')).toBe(true)
        })

        // A bip39 root arrives typed `seed` and is promoted during migration;
        // the exemption has to key off the promoted type, not the stored one.
        it('keeps the shadow for a root still typed seed on disk', async () => {
            await writeCanary13Record(store, {
                id: 'root-2',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey: new Uint8Array(96).fill(6),
                metadata: { scheme: 'bip39' },
            })

            await migrateKeystoreLayout(deps())

            expect(store.has('root-2')).toBe(true)
        })

        // Deliberately over-inclusive: this must cover every type
        // `configureHdRootKey` would select, and the two live in different
        // packages. Keeping one shadow too many costs a redundant ciphertext
        // phase 3 sweeps up; keeping one too few costs the provider a boot.
        it('shadows any seed-bearing record, not only the promoted root type', async () => {
            await writeCanary13Record(store, {
                id: 'seed-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                privateKey: new Uint8Array(32).fill(6),
                metadata: { scheme: 'algo25' },
            })

            await migrateKeystoreLayout(deps())

            expect(store.has('k/seed-1')).toBe(true)
            expect(store.has('seed-1')).toBe(true)
        })

        // Non-root wallet keys are re-indexed and dropped as before; the
        // exemption must not quietly become "never delete anything".
        it('still drops the bare entry for a record that is not a root', async () => {
            await writeCanary13Record(store, algo25Record('key-1'))

            await migrateKeystoreLayout(deps())

            expect(store.has('key-1')).toBe(false)
        })
    })

    // A material write that lands unreadable must not cost the canary.13 copy.
    it('keeps the canary.13 entry when the new buckets fail to read back', async () => {
        await writeCanary13Record(store, algo25Record('key-1'))
        const base = deps()

        const result = await migrateKeystoreLayout({
            ...base,
            storage: {
                ...base.storage,
                // Simulates a write that silently does not land.
                set: (key: string, value: string) => {
                    if (!key.startsWith('m/')) store.set(key, value)
                },
            },
        })

        expect(result).toEqual({ migrated: 0, skipped: 0, failed: 1 })
        expect(store.has('key-1')).toBe(true)
    })
})
