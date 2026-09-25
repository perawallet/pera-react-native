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
import { isPasskeyCredentialType } from './passkeyCredentialTypes'

/**
 * A decoded flat bare-id credential record, as `decode` returns it: byte
 * fields are `Uint8Array`, and a biometric-wrapped key is `privateKeyEnc:
 * { iv, data }` in standard base64. Older writers kept `origin`/`userHandle`/
 * `userId`/`count` at the top level instead of under `metadata`.
 */
export type FlatProviderCredential = {
    id?: string
    type?: string
    publicKey?: Uint8Array
    privateKey?: Uint8Array
    privateKeyEnc?: { iv?: unknown; data?: unknown }
    seed?: Uint8Array
    metadata?: Record<string, unknown>
    [field: string]: unknown
}

/** The plaintext `k/<id>` record, before `serializeKey`. */
export type SplitCredentialRecord = {
    id: string
    type: string
    publicKey: Uint8Array
    metadata: Record<string, unknown> & { origin: string }
    /** Only for a biometric-wrapped key: its GCM IV, never the ciphertext. */
    privateKeyEnc?: { iv: string }
    [field: string]: unknown
}

export type SplitProviderCredential = {
    record: SplitCredentialRecord
    /**
     * Sealed into `m/<id>`: the raw private key, or the biometric ciphertext
     * when `record.privateKeyEnc` is set. `undefined` for a credential with no
     * material, which re-derives at sign time.
     */
    material: Uint8Array | undefined
}

const LIFTED_FIELDS = ['origin', 'userHandle', 'userId', 'count'] as const

// Not `instanceof Uint8Array`: that fails across realms under jsdom.
const isBytes = (value: unknown): value is Uint8Array =>
    ArrayBuffer.isView(value) && !(value instanceof DataView)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isBytes(value)

const carriesBytes = (value: unknown): boolean => {
    if (isBytes(value)) return true
    if (typeof value !== 'object' || value === null) return false
    return Object.values(value).some(carriesBytes)
}

/**
 * True when the would-be `k/` record holds bytes anywhere but its own
 * top-level `publicKey`. A field's name says nothing about whether it is
 * secret: `decode` turns a number array under any `*Key` name into bytes, so a
 * `metadata.rootKey` or a top-level `masterKey` would otherwise be copied
 * straight into the plaintext `k/` record.
 */
const carriesBytesBesidesPublicKey = (
    record: Record<string, unknown>,
): boolean =>
    Object.entries(record).some(
        ([field, value]) => field !== 'publicKey' && carriesBytes(value),
    )

/**
 * Moves `origin`/`userHandle`/`userId`/`count` from the top level into
 * `metadata`, the only place the Android reader looks; a value already in
 * `metadata` wins. Returns the same reference when there is nothing to lift.
 */
export const liftCredentialMetadata = <T extends Record<string, unknown>>(
    record: T,
): T => {
    if (!LIFTED_FIELDS.some(field => field in record)) return record

    const metadata: Record<string, unknown> = {
        ...(isPlainObject(record.metadata) ? record.metadata : {}),
    }
    const rest: Record<string, unknown> = { ...record }
    for (const field of LIFTED_FIELDS) {
        if (!(field in rest)) continue
        if (metadata[field] === undefined) metadata[field] = rest[field]
        delete rest[field]
    }
    return { ...rest, metadata } as unknown as T
}

/**
 * Shapes a decoded flat credential record into its `k/` and `m/` halves.
 * Returns `undefined` for a record that cannot be stored in the split layout:
 * not a passkey type, no public key, no origin, a `seed` field, a `privateKey`
 * present but not usable bytes, bytes anywhere else in the record but its
 * top-level `publicKey`, or a biometric-wrapped key in a shape the provider
 * would not accept. Throws when `privateKeyEnc.data` is not base64.
 */
export const splitProviderCredential = (
    id: string,
    flat: FlatProviderCredential,
): SplitProviderCredential | undefined => {
    if (!isPasskeyCredentialType(flat.type)) return undefined
    if (!isBytes(flat.publicKey) || flat.publicKey.length === 0)
        return undefined

    const { privateKey, privateKeyEnc, seed, ...rest } = flat
    // Present at all, not just non-bytes: a seed this split does not carry
    // forward would be lost the moment the flat record is deleted.
    if (seed !== undefined) return undefined
    // Same reasoning for a privateKey in a shape this split cannot place —
    // an older writer's hex or base64url string, say — rather than absent.
    if (
        privateKey !== undefined &&
        !(isBytes(privateKey) && privateKey.length > 0)
    ) {
        return undefined
    }

    const lifted = liftCredentialMetadata({ ...rest, id })
    const metadata = isPlainObject(lifted.metadata) ? lifted.metadata : {}
    const origin = metadata.origin
    if (typeof origin !== 'string' || origin.length === 0) return undefined

    const record = {
        ...lifted,
        id,
        type: flat.type as string,
        publicKey: flat.publicKey,
        metadata: { ...metadata, origin },
    } as SplitCredentialRecord

    if (carriesBytesBesidesPublicKey(record)) return undefined

    if (isBytes(privateKey) && privateKey.length > 0) {
        return { record, material: privateKey }
    }

    if (privateKeyEnc !== undefined) {
        // The wrapped key is the only copy of the private key: anything but a
        // well-formed `{ iv, data }` stays flat instead of splitting empty.
        if (
            !isPlainObject(privateKeyEnc) ||
            typeof privateKeyEnc.iv !== 'string' ||
            typeof privateKeyEnc.data !== 'string'
        ) {
            return undefined
        }
        return {
            record: { ...record, privateKeyEnc: { iv: privateKeyEnc.iv } },
            material: base64.decode(privateKeyEnc.data),
        }
    }

    return { record, material: undefined }
}
