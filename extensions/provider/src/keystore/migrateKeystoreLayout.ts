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

import { base64 } from '@scure/base'
import type { KeyData } from '@algorandfoundation/keystore-core'
import { MATERIAL_PREFIX, METADATA_PREFIX } from './prefixes'

/**
 * The slice of the canary.14 package this migration stands on. Injected rather
 * than imported so the module carries no native dependency: the keystore
 * package pulls in `react-native-quick-crypto`, which cannot be loaded off
 * device. `singleton.ts` binds the real implementations.
 */
export type KeystoreLayoutMigrationDeps = {
    storage: {
        getAllKeys: () => string[]
        getString: (key: string) => string | undefined
        set: (key: string, value: string) => void
        remove: (key: string) => void
    }
    /** Reads the Keychain master key. canary.13 and canary.14 share the slot. */
    readMasterKey: () => Promise<Uint8Array>
    /** Reads a sealed payload; canary.14's handles canary.13's `{iv,tag,content}`. */
    openData: (key: Uint8Array, payload: string) => Promise<string>
    sealData: (key: Uint8Array, data: string) => Promise<string>
    /** Serializes `Key` metadata the way the canary.14 driver expects in `k/`. */
    encode: (key: KeyData) => string
    decode: (data: string) => KeyData
}

export type KeystoreLayoutMigrationResult = {
    migrated: number
    /** Already-migrated entries, plus leftovers from a run that died mid-record. */
    skipped: number
    /** Left in place, unmigrated — never deleted, so a later run can retry. */
    failed: number
}

/**
 * Records the layout this store has been migrated to.
 *
 * Deliberately **unsealed**: reading it must not cost a master-key read, since
 * avoiding that read is the entire point. It shares the MMKV namespace with the
 * keys, so `isLegacyEntry` has to exclude it explicitly or the scan would try
 * to migrate the marker itself.
 */
export const LAYOUT_VERSION_KEY = 'pera/keystore-layout-version'

/** Bump when a future layout change needs every store re-scanned (e.g. phase 3). */
export const LAYOUT_VERSION = 1

/**
 * canary.13 wrote one MMKV entry per key, keyed by the bare key id, holding the
 * whole encrypted `KeyData`. canary.14 splits that across two buckets:
 * `k/<id>` plaintext metadata and `m/<id>` sealed private material. Both the
 * driver and `reconcileKeystore` only ever scan `k/`, so an unmigrated entry is
 * invisible — the wallet renders empty while the bytes sit untouched on disk.
 */
const isLegacyEntry = (key: string): boolean =>
    key !== LAYOUT_VERSION_KEY &&
    !key.startsWith(METADATA_PREFIX) &&
    !key.startsWith(MATERIAL_PREFIX)

/** Field names that carry raw key material anywhere in a record. */
const SECRET_FIELDS = new Set(['privateKey', 'seed', 'key'])

/**
 * True for a passkey written by the Android credential provider, which shares
 * this MMKV instance (`PASSKEYS_MMKV_ID = "keystore"`) and this master key but
 * is a *different process* on the older bare-id layout.
 *
 * Those records look exactly like canary.13 keystore entries — same seal, same
 * encoding — so the migration would happily re-index one and delete the bare
 * key the provider reads back by (`mmkv.decodeString(credentialId)`),
 * destroying a working passkey. They also carry the biometric-wrapped
 * `privateKeyEnc`, which is not a `Uint8Array` and so would be dropped rather
 * than re-sealed. Leave them alone until the provider moves to this layout.
 */
const PASSKEY_CREDENTIAL_TYPES: ReadonlySet<string> = new Set([
    // What the provider writes today (`saveCredential`).
    'hd-derived-p256',
    // Older provider builds wrote this, and its read path still accepts it
    // (`keyType != "hd-derived-p256" && keyType != "xhd-derived-p256"`). Nothing
    // in this repo writes it, so it is unreachable here in theory — but the cost
    // of being wrong is a destroyed passkey, and the cost of covering it is a
    // set entry.
    'xhd-derived-p256',
])

const isPasskeyCredential = (record: KeyData): boolean => {
    const metadata = record.metadata as
        | { origin?: unknown; userHandle?: unknown }
        | undefined
    return (
        PASSKEY_CREDENTIAL_TYPES.has(record.type) &&
        typeof metadata?.origin === 'string' &&
        typeof metadata?.userHandle === 'string'
    )
}

/**
 * Types the Android credential provider can be pointed at as its derivation
 * root. `getHdRootSecret` reads that record back at its **bare id**, and the
 * canary.13 entry already sitting there is in the format it parses — so the
 * root migrates into `k/`+`m/` like any wallet key but keeps its bare copy as
 * the provider's shadow. Deleting it leaves every upgrading user able to
 * authenticate with existing passkeys and unable to create a new one.
 *
 * Deliberately the same superset `configureHdRootKey` scans
 * (`@perawallet/wallet-core-passkeys`), which is the authority on which id the
 * provider is actually given. The two cannot share a constant without a package
 * cycle, so this errs wide on purpose: one shadow too many is a redundant
 * ciphertext phase 3 removes, one too few is a boot the provider cannot derive.
 */
const HD_ROOT_SHADOW_TYPES: ReadonlySet<string> = new Set([
    'hd-root-key',
    'xhd-root-key',
    'hd-seed',
    'seed',
])

const SEALED_ENVELOPE_FIELDS: ReadonlySet<string> = new Set([
    'iv',
    'tag',
    'content',
])

/**
 * True for a sealed envelope our own encoder could not have written.
 *
 * `@scure/base`'s `base64.encode` always pads, so every payload the keystore
 * writes decodes cleanly. The iOS credential provider seals with Foundation's
 * encoder and emits **unpadded** base64 — well-formed JSON that `openData`
 * rejects (`padding: invalid, string should have whole number of bytes`) before
 * the record can be typed, which is why `isPasskeyCredential` never sees it.
 *
 * The distinction earns its keep: a record of ours that fails to open must keep
 * counting as a failure so the stamp is withheld and a later run retries, while
 * a foreign one never becomes readable and would withhold the stamp forever.
 */
const isForeignEnvelope = (raw: string): boolean => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return false
    }
    if (typeof parsed !== 'object' || parsed === null) return false

    const sealedFields = Object.entries(
        parsed as Record<string, unknown>,
    ).filter(([field]) => SEALED_ENVELOPE_FIELDS.has(field))
    if (sealedFields.length === 0) return false

    return sealedFields.some(([, value]) => {
        if (typeof value !== 'string') return true
        try {
            base64.decode(value)
            return false
        } catch {
            return true
        }
    })
}

/** Material lifted out of a record, addressed by the id it belongs to. */
type LiftedMaterial = { id: string; bytes: Uint8Array }

/**
 * Lifts key material out of a record at every depth, returning the plaintext-safe
 * remainder plus everything that has to be sealed instead.
 *
 * canary.13 sealed the *whole* record, so nesting material inside `metadata` was
 * safe at rest — and it does: an HD-derived key carries its parent under
 * `metadata.rootKey`, `privateKey` included. canary.14 keeps `k/` in plaintext,
 * so copying `metadata` verbatim would write an HD wallet's root private key to
 * disk unencrypted.
 *
 * Material is never discarded on the way out: each nested carrier names the id it
 * belongs to, so the bytes are re-sealed under that id's `m/` entry rather than
 * dropped. `ownerId` is the id inherited from the enclosing object, so a bare
 * `{ privateKey }` with no `id` of its own is still attributed correctly.
 */
const liftSecrets = <T>(
    value: T,
    ownerId: string | undefined,
    lifted: LiftedMaterial[],
): T => {
    if (Array.isArray(value)) {
        return value.map(item =>
            liftSecrets(item, ownerId, lifted),
        ) as unknown as T
    }
    // Uint8Array is an object but must survive intact (e.g. `publicKey`).
    if (value instanceof Uint8Array || value === null) return value
    if (typeof value !== 'object') return value

    const entries = Object.entries(value as Record<string, unknown>)
    const id = entries.find(([field]) => field === 'id')?.[1]
    const scopeId = typeof id === 'string' ? id : ownerId

    const kept: [string, unknown][] = []
    for (const [field, nested] of entries) {
        if (SECRET_FIELDS.has(field)) {
            if (nested instanceof Uint8Array && scopeId) {
                lifted.push({ id: scopeId, bytes: nested })
            }
            continue
        }
        kept.push([field, liftSecrets(nested, scopeId, lifted)])
    }
    return Object.fromEntries(kept) as T
}

/** canary.13's spelling of the Falcon child type; canary.14 uses `falcon-1024`. */
const LEGACY_FALCON_TYPE = 'falcon1024'

/** PKCS#8 DER header for an Ed25519 private key, per keystore-core. */
const ED25519_PKCS8_PREFIX = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20,
])

/** Length of libsodium's Ed25519 secret key: 32-byte seed || 32-byte public. */
const LIBSODIUM_SECRET_KEY_LENGTH = 64

const toPkcs8 = (seed: Uint8Array): Uint8Array => {
    const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + seed.length)
    pkcs8.set(ED25519_PKCS8_PREFIX, 0)
    pkcs8.set(seed, ED25519_PKCS8_PREFIX.length)
    return pkcs8
}

/** Mirrors keystore-core's `parsePath`: apostrophe/h marks a hardened segment. */
const parseBip44Path = (path: string): number[] =>
    path
        .replace(/^m\/?/, '')
        .split('/')
        .filter(part => part.length > 0)
        .map(part => {
            const hardened = part.endsWith("'") || part.endsWith('h')
            const index = Number.parseInt(part.replace(/['h]$/, ''), 10)
            return hardened ? index + 0x80_00_00_00 : index
        })

/**
 * Rewrites a canary.13 record into canary.14's vocabulary.
 *
 * Re-indexing the storage keys is not enough. `sign` dispatches on `type` and
 * reads `metadata.signAlgorithm`, `format` and — for XHD children —
 * `metadata.bip44Path`. A record that keeps canary.13's spelling decodes fine
 * and then throws inside the host `importKey`, so the wallet renders a balance
 * it cannot spend: `falcon1024` misses the `falcon-1024` case and falls to the
 * default branch, where `signAlgorithm` defaults to `{ name: 'EdDSA' }` — a JWK
 * `alg` value, not a WebCrypto algorithm name.
 */
const normalizeForCanary14 = (
    record: KeyData,
    material: Uint8Array | undefined,
): { metadata: KeyData; material: Uint8Array | undefined } => {
    const metadata: KeyData = {
        ...record,
        metadata: { ...(record.metadata ?? {}) },
    }
    const meta = metadata.metadata as Record<string, unknown>
    let bytes = material

    if (record.type === LEGACY_FALCON_TYPE) {
        metadata.type = 'falcon-1024'
        metadata.algorithm = 'Falcon-1024'
    }

    if (record.type === 'seed' && meta.scheme === 'bip39') {
        // These bytes are the 96-byte XHD extended root, not a BIP39 seed, and
        // `deriveFromSeed` rejects any parent not typed `hd-root-key`. `scheme`
        // stays put: kms reads it to pick the wallet kind, and core branches
        // only on `type` here.
        metadata.type = 'hd-root-key'
    }

    if (
        record.type === 'ed25519' &&
        bytes?.length === LIBSODIUM_SECRET_KEY_LENGTH
    ) {
        // canary.13 stored the libsodium secret key raw; canary.14 re-imports
        // material through the host Subtle, which takes PKCS#8.
        bytes = toPkcs8(bytes.slice(0, 32))
        metadata.format = 'pkcs8'
        meta.signAlgorithm = { name: 'Ed25519' }
    }

    if (record.type === 'hd-derived-ed25519') {
        // canary.13 recorded `path`/`derivation`; `sign` reads the parsed
        // `bip44Path` and `derivationType`, and silently derives from
        // `undefined` segments without them.
        if (typeof meta.path === 'string' && meta.bip44Path === undefined) {
            meta.bip44Path = parseBip44Path(meta.path)
        }
        if (meta.derivationType === undefined) {
            meta.derivationType = meta.derivation
        }
    }

    meta.storage = bytes ? 'bytes' : 'none'

    return { metadata, material: bytes }
}

/**
 * Reads both new buckets back through the same helpers the engine uses, so a
 * truncated or unreadable write is caught while the canary.13 entry is still on
 * disk. Returning `false` leaves that entry in place for the next launch.
 */
const isMigrationDurable = async (
    deps: KeystoreLayoutMigrationDeps,
    id: string,
    material: Uint8Array | undefined,
    masterKey: Uint8Array,
): Promise<boolean> => {
    const metadata = deps.storage.getString(METADATA_PREFIX + id)
    if (!metadata) return false
    if (deps.decode(metadata).id !== id) return false

    if (!material) return true

    const sealed = deps.storage.getString(MATERIAL_PREFIX + id)
    if (!sealed) return false

    return (await deps.openData(masterKey, sealed)) === base64.encode(material)
}

/**
 * Re-indexes canary.13 keystore records into the canary.14 two-bucket layout.
 *
 * Nothing is re-encrypted: both versions seal against the same Keychain master
 * key (`service: "app-secret"`), share one MMKV instance (`id: "keystore"`), and
 * canary.14's `openData` still reads canary.13's `{iv, tag, content}` payloads.
 * Only the storage keys change.
 *
 * Safe to run on every launch: it is a no-op once no bare-id entries remain, and
 * a record is dropped only after both new buckets are verified readable, so an
 * interrupted run resumes rather than losing material.
 *
 * Must run before `reconcileKeystore` re-seeds the store — the engine's own
 * `ready` hydration sees only `k/` and would otherwise report zero keys.
 */
export const migrateKeystoreLayout = async (
    deps: KeystoreLayoutMigrationDeps,
): Promise<KeystoreLayoutMigrationResult> => {
    const result: KeystoreLayoutMigrationResult = {
        migrated: 0,
        skipped: 0,
        failed: 0,
    }

    const allKeys = deps.storage.getAllKeys()

    // An empty store has to stay *literally* empty. canary.14 mints the
    // Keychain master key only while `getAllKeys()` is empty
    // (`masterKeyForWrite`), on the reasoning that a populated store with no
    // master means one went missing and minting a replacement would orphan
    // every sealed record. So a lone stamp is not a free marker: it blocks the
    // first write forever and the wallet can never create its first account.
    // Removing it here also un-bricks a device that already ran a build which
    // stamped too early — that store holds nothing else, so no other code path
    // can recover it.
    if (!allKeys.some(key => key !== LAYOUT_VERSION_KEY)) {
        deps.storage.remove(LAYOUT_VERSION_KEY)
        return result
    }

    // The cheap exit, and the reason the stamp exists at all. Bare ids stay
    // occupied for good once the credential provider owns any — its records
    // and the HD root shadow are skipped, never consumed — so "no bare ids
    // left" cannot mean "migrated". Without this, every launch would re-read
    // the Keychain master key and decrypt one record per stored passkey only
    // to skip it, and canary.14 no longer caches that master key.
    if (deps.storage.getString(LAYOUT_VERSION_KEY) === String(LAYOUT_VERSION)) {
        return result
    }

    const legacyIds = allKeys.filter(isLegacyEntry)
    if (legacyIds.length === 0) {
        // Already on the new layout; stamp so no later launch pays for the scan.
        deps.storage.set(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION))
        return result
    }

    // Deferred until there is something to migrate: on a fresh install the
    // Keychain entry does not exist yet and this would throw
    // MasterKeyNotFoundError before the keystore ever creates one.
    const masterKey = await deps.readMasterKey()

    for (const id of legacyIds) {
        try {
            // A previous run wrote the new buckets and died before the cleanup;
            // the canary.13 copy is redundant, not a second key. Unless it is
            // the root's shadow, which every later run must leave alone.
            const migratedMetadata = deps.storage.getString(
                METADATA_PREFIX + id,
            )
            if (migratedMetadata) {
                if (
                    !HD_ROOT_SHADOW_TYPES.has(
                        deps.decode(migratedMetadata).type,
                    )
                ) {
                    deps.storage.remove(id)
                }
                result.skipped += 1
                continue
            }

            const raw = deps.storage.getString(id)
            if (!raw) {
                result.skipped += 1
                continue
            }

            // Reading is its own step so a foreign record can be told apart
            // from one of ours that failed. The iOS credential provider's
            // records throw here — before `isPasskeyCredential` below could
            // recognise them — and no retry will ever change that, so treating
            // them as failures withholds the stamp for good and makes every
            // launch re-read the Keychain master key to fail again. Nothing is
            // written or removed for this id, so the owning process still reads
            // it back exactly where it left it. Anything else rethrows and is
            // counted a failure, unchanged.
            let record: KeyData
            try {
                record = deps.decode(await deps.openData(masterKey, raw))
            } catch (err) {
                if (!isForeignEnvelope(raw)) throw err
                console.warn(
                    `[provider] keystore layout migration: entry ${id} was not written by this keystore; leaving it untouched`,
                )
                result.skipped += 1
                continue
            }

            // Owned by another process on the old layout — re-indexing it would
            // delete the key that process reads back by.
            if (isPasskeyCredential(record)) {
                result.skipped += 1
                continue
            }

            // `seed` is untyped but real: both versions' `commit` strip it
            // alongside `privateKey`, and both `decode` revivers rebuild it. It
            // must never reach `k/`, which is plaintext. Where a record carries
            // only a seed it *is* the material — canary.13's `importSeed` puts
            // the seed in `privateKey`, so the two never hold different secrets.
            const lifted: LiftedMaterial[] = []
            const stripped = liftSecrets(record, record.id, lifted)
            const own = lifted.find(entry => entry.id === record.id)?.bytes
            const { metadata, material } = normalizeForCanary14(
                stripped as KeyData,
                own,
            )

            // Every secret goes straight into the sealed bucket, addressed by the
            // id that owns it — including ones lifted out of nested metadata, so
            // material is re-protected rather than discarded. An id already
            // sealed by its own record is left alone: that entry is the
            // authority, and an embedded copy must never overwrite it.
            for (const entry of lifted) {
                const materialKey = MATERIAL_PREFIX + entry.id
                if (
                    entry.id !== record.id &&
                    deps.storage.getString(materialKey)
                ) {
                    continue
                }
                // The record's own material may have been re-encoded above
                // (raw Ed25519 secret key -> PKCS#8); nested copies pass
                // through untouched.
                const bytes = entry.id === record.id ? material : entry.bytes
                if (!bytes) continue
                deps.storage.set(
                    materialKey,
                    await deps.sealData(masterKey, base64.encode(bytes)),
                )
            }

            deps.storage.set(METADATA_PREFIX + record.id, deps.encode(metadata))

            if (
                !(await isMigrationDurable(
                    deps,
                    record.id,
                    material,
                    masterKey,
                ))
            ) {
                result.failed += 1
                continue
            }

            // The root's bare entry stays put as the credential provider's
            // shadow; everything else is now redundant.
            if (!HD_ROOT_SHADOW_TYPES.has(metadata.type)) {
                deps.storage.remove(id)
            }
            result.migrated += 1
        } catch (err) {
            console.error(
                `[provider] keystore layout migration: entry ${id} left unmigrated`,
                err,
            )
            result.failed += 1
        }
    }

    // Only on a clean pass. Anything that failed was deliberately left on disk
    // for a later run, and stamping here would strand it for good.
    if (result.failed === 0) {
        deps.storage.set(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION))
    }

    return result
}
