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

import type { KeyData } from '@algorandfoundation/keystore-core'

/**
 * canary.13 record shape. `seed` is untyped upstream but real: both versions'
 * `commit` strip it alongside `privateKey`, and both `decode` revivers rebuild
 * it, so a record can carry its material there instead.
 */
export type Canary13Record = KeyData & { seed?: Uint8Array }

/** Field names that carry raw key material anywhere in a record. */
export const SECRET_FIELDS: ReadonlySet<string> = new Set([
    'privateKey',
    'seed',
    'key',
])

/** Material lifted out of a record, addressed by the id it belongs to. */
export type LiftedMaterial = { id: string; bytes: Uint8Array }

/**
 * Lifts key material out of a record at every depth, returning the
 * plaintext-safe remainder plus everything that has to be sealed instead.
 *
 * canary.13 sealed the *whole* record, so nesting material inside `metadata`
 * was safe at rest — and it does: an HD-derived key carries its parent under
 * `metadata.rootKey`, `privateKey` included. The split layout keeps `k/` in
 * plaintext, so copying `metadata` verbatim would write an HD wallet's root
 * private key to disk unencrypted.
 *
 * Every secret is *reported*, never silently skipped: each carrier names the id
 * it belongs to, so the bytes can be re-sealed under that id's `m/` entry.
 * `ownerId` is the id inherited from the enclosing object, so a bare
 * `{ privateKey }` with no `id` of its own is attributed to the record that
 * encloses it.
 *
 * Reported is not the same as stored, and this function does not promise
 * storage. One id addresses one `m/` bucket, so an id-less carrier resolves to
 * the same bucket as the record's own material and only one of the two can be
 * sealed. Resolving that is the caller's job — see `placeSecrets` in
 * `sealing.ts`, which refuses the record rather than let either secret go
 * unstored.
 */
export const liftSecrets = <T>(
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

/**
 * Zeroes every secret in a decrypted record, at every depth.
 *
 * Walks the same shape `liftSecrets` does, so a carrier it can pull material
 * out of is one this can erase. Called from a `finally` covering *every* exit —
 * adopted, declined, left flat, failed — because a record that was decrypted
 * and then not taken still had its private key bytes in the heap, and upstream's
 * own `clearBuffer(material)` sits in a `finally` for the same reason.
 */
export const wipeSecrets = (value: unknown): void => {
    if (value instanceof Uint8Array || value === null) return
    if (Array.isArray(value)) {
        for (const item of value) wipeSecrets(item)
        return
    }
    if (typeof value !== 'object') return

    for (const [field, nested] of Object.entries(
        value as Record<string, unknown>,
    )) {
        if (SECRET_FIELDS.has(field) && nested instanceof Uint8Array) {
            nested.fill(0)
            continue
        }
        wipeSecrets(nested)
    }
}

const carriesMaterial = (value: unknown): boolean => {
    if (value instanceof Uint8Array || value === null) return false
    if (Array.isArray(value)) return value.some(carriesMaterial)
    if (typeof value !== 'object') return false

    return Object.entries(value as Record<string, unknown>).some(
        ([field, nested]) =>
            (SECRET_FIELDS.has(field) && nested instanceof Uint8Array) ||
            carriesMaterial(nested),
    )
}

/**
 * True when any key anywhere in `value` is a secret-field NAME, whether it
 * holds bare material or a container. This is the check `liftSecrets`'s count
 * cannot make: it walks PAST a secret name holding a container (neither lifts
 * it nor keeps it), so a `{ key: { … } }` is invisible to a single-secret gate
 * yet would still be serialised into plaintext `k/`.
 */
const carriesSecretName = (value: unknown): boolean => {
    if (value instanceof Uint8Array || value === null) return false
    if (Array.isArray(value)) return value.some(carriesSecretName)
    if (typeof value !== 'object') return false

    return Object.entries(value as Record<string, unknown>).some(
        ([field, nested]) =>
            SECRET_FIELDS.has(field) || carriesSecretName(nested),
    )
}

/**
 * True when material sits somewhere *below* the record's top level.
 *
 * This is the exact blind spot in upstream's `adoptLegacyRecords`, which
 * destructures `const { privateKey, seed, ...meta } = keyData` and writes
 * `serializeKey(meta)` straight into the plaintext `k/` bucket. Top-level
 * fields are the only ones it strips.
 */
export const hasNestedMaterial = (record: Canary13Record): boolean =>
    Object.entries(record as unknown as Record<string, unknown>).some(
        ([field, value]) => !SECRET_FIELDS.has(field) && carriesMaterial(value),
    )

/** The parent root a nested-only child carries, addressed by its own id. */
export type NestedRootShape = { rootId: string; rootMaterial: Uint8Array }

/**
 * Recognises the one nested shape safe to adopt as a metadata-only child: an
 * HD-derived record whose only material is its parent's private key under
 * `metadata.rootKey`. Returns `undefined` for anything else — a second nested
 * carrier, a `rootKey` with no `id` of its own, a secret under a name this pass
 * cannot place — so the caller refuses rather than guess. Refusing costs
 * nothing (the bare record survives); guessing wrong can discard a wallet's
 * only remaining root key.
 */
export const recognizedNestedShape = (
    record: Canary13Record,
): NestedRootShape | undefined => {
    const lifted: LiftedMaterial[] = []
    liftSecrets(record, record.id, lifted)
    if (lifted.length !== 1) return undefined

    const [only] = lifted
    const nested = (record.metadata as { rootKey?: Canary13Record } | undefined)
        ?.rootKey
    if (nested === undefined) return undefined
    if (typeof only.id !== 'string' || nested.id !== only.id) return undefined
    if (nested.privateKey !== only.bytes) return undefined

    // The caller drops `metadata.rootKey` and serialises the rest into
    // plaintext `k/`. The single-secret count above misses a secret-NAMED
    // container living outside `rootKey`, so refuse if any secret name remains
    // once `rootKey` is set aside — its bytes must never reach `k/`.
    const { rootKey: _rootKey, ...metadataSansRoot } = (record.metadata ??
        {}) as Record<string, unknown>
    if (carriesSecretName({ ...record, metadata: metadataSansRoot })) {
        return undefined
    }

    return { rootId: only.id, rootMaterial: only.bytes }
}

/** canary.13's spelling of the Falcon child type; canary.19 uses `falcon-1024`. */
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

const isPkcs8 = (bytes: Uint8Array): boolean =>
    bytes.length > ED25519_PKCS8_PREFIX.length &&
    ED25519_PKCS8_PREFIX.every((byte, index) => bytes[index] === byte)

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

export type NormalizeInput = {
    record: Canary13Record
    /**
     * The record's opened material, when the caller has already decided it may
     * need re-encoding. Absent means "don't touch the material".
     */
    material?: Uint8Array
    /** Whether an `m/<id>` entry exists at all — decides `metadata.storage`. */
    hasMaterial: boolean
}

export type NormalizeResult = {
    metadata: Canary13Record
    /** Set only when the material itself had to be re-encoded. */
    material?: Uint8Array
}

/**
 * Rewrites a canary.13 record into the vocabulary canary.19 reads.
 *
 * Re-indexing the storage keys is not enough. `sign` dispatches on `type` and
 * reads `metadata.signAlgorithm`, `format` and — for XHD children —
 * `metadata.bip44Path`. A record that keeps canary.13's spelling decodes fine
 * and then throws inside the host `importKey`, so the wallet renders a balance
 * it cannot spend: `falcon1024` misses the `falcon-1024` case and falls to the
 * default branch, where `signAlgorithm` defaults to `{ name: 'EdDSA' }` — a JWK
 * `alg` value, not a WebCrypto algorithm name.
 */
export const normalizeCanary13Record = ({
    record,
    material,
    hasMaterial,
}: NormalizeInput): NormalizeResult => {
    const metadata: Canary13Record = {
        ...record,
        metadata: { ...(record.metadata ?? {}) },
    }
    const meta = metadata.metadata as Record<string, unknown>
    let bytes: Uint8Array | undefined

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

    if (record.type === 'ed25519' && meta.signAlgorithm === undefined) {
        if (material?.length === LIBSODIUM_SECRET_KEY_LENGTH) {
            // canary.13 stored the libsodium secret key raw; canary.19
            // re-imports material through the host Subtle, which takes PKCS#8.
            bytes = toPkcs8(material.slice(0, 32))
            metadata.format = 'pkcs8'
            meta.signAlgorithm = { name: 'Ed25519' }
        } else if (material && isPkcs8(material)) {
            // Resumes a run that re-sealed `m/<id>` and died before rewriting
            // `k/<id>`. Without this the record is stuck: the length test above
            // no longer matches, so `format`/`signAlgorithm` would never land.
            metadata.format = 'pkcs8'
            meta.signAlgorithm = { name: 'Ed25519' }
        }
    }

    if (record.type === 'hd-derived-ed25519') {
        // `deriveFromSeed` wrote the raw path under `derivationPath`
        // (`dist/store.js:290`); `path` is the generate-created spelling.
        // `sign` reads the parsed `bip44Path` and `derivationType`, and
        // silently derives from `undefined` segments without them.
        if (meta.bip44Path === undefined) {
            const rawPath =
                typeof meta.derivationPath === 'string'
                    ? meta.derivationPath
                    : typeof meta.path === 'string'
                      ? meta.path
                      : undefined
            if (rawPath !== undefined) {
                meta.bip44Path = parseBip44Path(rawPath)
            }
        }
        if (
            meta.derivationType === undefined &&
            meta.derivation !== undefined
        ) {
            meta.derivationType = meta.derivation
        }
    }

    if (meta.storage === undefined) {
        meta.storage = hasMaterial ? 'bytes' : 'none'
    }

    return { metadata, material: bytes }
}
