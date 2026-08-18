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

import { base64, base64url } from '@scure/base'
import type { KeyData } from '@algorandfoundation/keystore-core'

/**
 * Stand-ins for the three keystore primitives whose real modules cannot be
 * imported off device.
 *
 * `MATERIAL_PREFIX`, `METADATA_PREFIX`, `serializeKey` and
 * `MasterKeyNotFoundError` are re-exported from the package's real dist in each
 * spec's `vi.mock` factory instead, because their modules only depend on
 * `@scure/base` and `keystore-core`. These three cannot follow: `crypto.js`
 * pulls in `react-native-keychain` and `react-native-quick-crypto`, and
 * `state.js` pulls in `react-native-mmkv` — neither resolves under vitest, and
 * `vi.mock` does not reach inside an externalised dependency's own graph.
 *
 * They re-implement the on-disk formats read out of that dist over the same
 * AES-256-GCM primitives, so they pin behaviour and the metadata/material
 * split; they cannot prove byte compatibility with upstream, which is what
 * on-device verification is for.
 */

const IV_LENGTH = 12
const GCM_TAG_LENGTH = 16

const importAesKey = (subtle: SubtleCrypto, key: Uint8Array) =>
    subtle.importKey('raw', key as BufferSource, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
    ])

/** `sealData`: `{iv, content}` JSON, GCM tag inside `content`. */
export const sealData = async (
    subtle: SubtleCrypto,
    key: Uint8Array,
    data: string,
): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = new Uint8Array(
        await subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            await importAesKey(subtle, key),
            new TextEncoder().encode(data) as BufferSource,
        ),
    )
    return JSON.stringify({
        iv: base64.encode(iv),
        content: base64.encode(ciphertext),
    })
}

/** `openData`, including its legacy `{iv, tag, content}` branch. */
export const openData = async (
    subtle: SubtleCrypto,
    key: Uint8Array,
    payload: string,
): Promise<string> => {
    const { iv, tag, content } = JSON.parse(payload) as {
        iv: string
        tag?: string
        content: string
    }
    const body = base64.decode(content)
    const ciphertext =
        typeof tag === 'string'
            ? new Uint8Array([...body, ...base64.decode(tag)])
            : body

    return new TextDecoder().decode(
        await subtle.decrypt(
            { name: 'AES-GCM', iv: base64.decode(iv) as BufferSource },
            await importAesKey(subtle, key),
            ciphertext as BufferSource,
        ),
    )
}

/**
 * Every record `decode` has handed out since the last {@link resetDecoded}.
 *
 * The arrays inside these are the very ones a revision lifts and seals, so this
 * is the only handle a test has on whether decrypted material was zeroed once
 * the revision was done with it.
 */
export const decodedRecords: KeyData[] = []

export const resetDecoded = (): void => {
    decodedRecords.length = 0
}

/** `decode`, which accepts both the `{ $u8 }` format and canary.13's. */
export const decode = (data: string): KeyData => {
    const record = decodeRecord(data)
    decodedRecords.push(record)
    return record
}

const decodeRecord = (data: string): KeyData => {
    if (data.startsWith('{')) {
        return JSON.parse(data, (_key, value) =>
            value && typeof value === 'object' && typeof value.$u8 === 'string'
                ? base64.decode(value.$u8)
                : value,
        ) as KeyData
    }
    return JSON.parse(
        new TextDecoder().decode(base64url.decode(data)),
        (key, value) =>
            (key.endsWith('Key') ||
                key === 'privateKey' ||
                key === 'publicKey' ||
                key === 'seed' ||
                key === 'key') &&
            Array.isArray(value)
                ? new Uint8Array(value as number[])
                : value,
    ) as KeyData
}

/**
 * Writes a record the way canary.13 did: the whole `KeyData` sealed under its
 * bare id, byte fields as number arrays, GCM tag in its own field.
 */
/**
 * The record canary.13's `deriveFromSeed` actually wrote: no material of its
 * own, the parent's private key nested under `metadata.rootKey`.
 * See `react-native-keystore@1.0.0-canary.13/dist/store.js:282-303`.
 */
export const canary13DerivedChild = ({
    id,
    parentKeyId,
    rootPrivateKey,
    publicKey = new Uint8Array(32).fill(1),
}: {
    id: string
    parentKeyId: string
    rootPrivateKey: Uint8Array
    publicKey?: Uint8Array
}): KeyData =>
    ({
        id,
        type: 'hd-derived-ed25519',
        algorithm: 'EdDSA',
        extractable: false,
        keyUsages: ['sign', 'verify'],
        publicKey,
        metadata: {
            derivationPath: "m/44'/283'/0'/0/0",
            parentKeyId,
            context: 0,
            account: 0,
            keyIndex: 0,
            rootKey: {
                id: parentKeyId,
                type: 'hd-root-key',
                algorithm: 'raw',
                privateKey: rootPrivateKey,
            },
        },
    }) as unknown as KeyData

export const sealCanary13Record = async (
    subtle: SubtleCrypto,
    key: Uint8Array,
    record: Record<string, unknown>,
): Promise<string> => {
    const json = JSON.stringify(record, (_k, value) =>
        value instanceof Uint8Array ? Array.from(value) : value,
    )
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const sealed = new Uint8Array(
        await subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            await importAesKey(subtle, key),
            new TextEncoder().encode(
                base64url.encode(new TextEncoder().encode(json)),
            ) as BufferSource,
        ),
    )
    return JSON.stringify({
        iv: base64.encode(iv),
        content: base64.encode(sealed.slice(0, -GCM_TAG_LENGTH)),
        tag: base64.encode(sealed.slice(-GCM_TAG_LENGTH)),
    })
}
