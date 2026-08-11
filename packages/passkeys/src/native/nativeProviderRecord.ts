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

/**
 * The on-disk contract of the Android credential provider
 * (`react-native-passkey-autofill`'s `CredentialRepository`).
 *
 * The provider is a **separate process** that shares this app's keystore MMKV
 * instance (`PASSKEYS_MMKV_ID = "keystore"`) and master key, but is still on the
 * pre-canary.14 bare-id layout. Everything it reads and writes lives at an
 * unprefixed key — no `k/`, no `m/`.
 *
 * This module is the single place that contract is expressed, because two
 * separate things need it and a third will:
 *
 * 1. Writing credentials migrated from Pera 6 so the provider can read them.
 * 2. Writing the HD root record the provider derives new credentials from.
 * 3. **Phase 3** — reading both back, once the provider moves to `k/`+`m/`, so
 *    the records can be migrated into the keystore's own layout without loss.
 *
 * ## Why `sealData`/`encode` from the keystore cannot be used
 *
 * Under canary.14 they are wrong on two independent axes, and both fail
 * silently:
 *
 * - `sealData` emits `{iv, content}` with the GCM tag appended to the
 *   ciphertext. The provider's `decodeKeyData` only takes its decrypt branch
 *   when the envelope has `iv` **and** `tag` **and** `content`; otherwise it
 *   returns the envelope object itself, which has no key material in it.
 * - `encode` serialises a `Uint8Array` as `{"$u8": "<base64>"}`. The provider
 *   does `getJSONArray("privateKey")` / `optJSONArray("seed")` and expects a
 *   **JSON array of byte values**.
 *
 * Neither throws. A record written with the keystore's own helpers is simply
 * invisible to the provider, which is exactly the failure this module exists to
 * prevent.
 */

/** AES-GCM parameters the provider's Kotlin seal/open path assumes. */
const IV_BYTE_LENGTH = 12
const GCM_TAG_BYTE_LENGTH = 16

/**
 * The provider's envelope. `iv`/`tag`/`content` are **standard** base64 (it
 * decodes with `AndroidBase64.DEFAULT`), and the plaintext inside is
 * **base64url** of the record JSON.
 */
export type NativeProviderEnvelope = {
    iv: string
    tag: string
    content: string
}

const toStandardBase64 = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))

/**
 * Exported so the bootstrap can decode the keystore's sealed material without
 * pulling `@scure/base` into this package. That dependency has to be bundled
 * into `dist/` rather than externalised, and getting that wrong takes down the
 * browser extension's service worker at module-eval — the package root reaches
 * the web bundle even though this module is Android-only.
 */
export const fromStandardBase64 = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), char => char.charCodeAt(0))

const toBase64Url = (value: string): string =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (value: string): string =>
    atob(value.replace(/-/g, '+').replace(/_/g, '/'))

/**
 * Byte arrays cross this boundary as JSON arrays of numbers, never `{$u8}` and
 * never base64 — see the module doc.
 */
export const toNativeByteArray = (bytes: Uint8Array): number[] =>
    Array.from(bytes)

export const fromNativeByteArray = (values: number[]): Uint8Array =>
    Uint8Array.from(values)

/**
 * Seals a record into the envelope the provider can decrypt.
 *
 * Splitting the trailing 16 bytes of the ciphertext back out into `tag` is the
 * whole point: Subtle appends the GCM tag, the provider expects it separately.
 */
export const sealNativeProviderRecord = async (
    subtle: SubtleCrypto,
    masterKey: Uint8Array,
    record: unknown,
): Promise<string> => {
    const cryptoKey = await subtle.importKey(
        'raw',
        masterKey as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
    )
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))
    const plaintext = new TextEncoder().encode(
        toBase64Url(JSON.stringify(record)),
    )
    const sealed = new Uint8Array(
        await subtle.encrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            cryptoKey,
            plaintext as unknown as BufferSource,
        ),
    )

    const boundary = sealed.length - GCM_TAG_BYTE_LENGTH
    return JSON.stringify({
        iv: toStandardBase64(iv),
        tag: toStandardBase64(sealed.subarray(boundary)),
        content: toStandardBase64(sealed.subarray(0, boundary)),
    } satisfies NativeProviderEnvelope)
}

/**
 * Reads a record the provider wrote — or that {@link sealNativeProviderRecord}
 * wrote — back out.
 *
 * Both shapes the provider can produce are accepted, because it falls back to
 * writing the bare base64url payload when no master key is available:
 * `{iv, tag, content}` and unsealed base64url JSON. Phase 3's migration needs
 * both; dropping the unsealed case would silently lose those records.
 */
export const openNativeProviderRecord = async (
    subtle: SubtleCrypto,
    masterKey: Uint8Array,
    payload: string,
): Promise<unknown> => {
    if (!payload.startsWith('{')) {
        return JSON.parse(fromBase64Url(payload))
    }

    const envelope = JSON.parse(payload) as Partial<NativeProviderEnvelope>
    if (!envelope.iv || !envelope.tag || !envelope.content) {
        throw new Error(
            'Not a credential-provider envelope: expected iv, tag and content.',
        )
    }

    const cryptoKey = await subtle.importKey(
        'raw',
        masterKey as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
    )
    const content = fromStandardBase64(envelope.content)
    const tag = fromStandardBase64(envelope.tag)
    const sealed = new Uint8Array(content.length + tag.length)
    sealed.set(content)
    sealed.set(tag, content.length)

    const plaintext = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: fromStandardBase64(envelope.iv) as unknown as BufferSource,
        },
        cryptoKey,
        sealed as unknown as BufferSource,
    )
    return JSON.parse(fromBase64Url(new TextDecoder().decode(plaintext)))
}
