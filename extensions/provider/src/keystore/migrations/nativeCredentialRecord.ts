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
 * Writes the flat bare-id record the native Android/iOS passkey credential
 * provider reads — byte-for-byte the same on-disk contract
 * `packages/passkeys/src/native/nativeProviderRecord.ts`'s
 * `sealNativeProviderRecord` produces.
 *
 * Restated here rather than imported: `packages/passkeys` already depends on
 * `@perawallet/wallet-extension-provider` (this package), so importing back
 * from here would be a circular workspace dependency. See that module's doc
 * for the full contract (why `sealData`/`encode` from this package's own
 * `crypto.ts`/`state.ts` cannot be used — both fail silently against the
 * provider) and for the credential-record field shapes this must match.
 *
 * `__tests__/nativeCredentialRecord.spec.ts` proves this stays byte-compatible
 * two ways: a live round trip through the real `openNativeProviderRecord`
 * (imported by deep relative path — a `package.json` dependency on
 * `@perawallet/wallet-core-passkeys` trips turbo's whole-graph cycle check,
 * but a relative import creates no such edge), and a golden envelope pinned
 * from an earlier such round trip, kept alongside it. See that spec's doc.
 */

const IV_BYTE_LENGTH = 12
const GCM_TAG_BYTE_LENGTH = 16

const toStandardBase64 = (bytes: Uint8Array): string =>
    btoa(String.fromCharCode(...bytes))

/**
 * UTF-8-encodes before base64-ing, so a non-Latin1 `userName`/`displayName`
 * doesn't throw `btoa`'s `InvalidCharacterError` mid-write — Android's own
 * writer does the equivalent (`jsonString.toByteArray(Charsets.UTF_8)` before
 * `Base64.encodeToString`), and keeps the padding
 * `Base64.encodeToString(..., URL_SAFE or NO_WRAP)` produces by default,
 * because the keystore package's own `decode` requires it (`base64url.decode`
 * from `@scure/base` throws on an unpadded string).
 */
const toBase64Url = (value: string): string =>
    toStandardBase64(new TextEncoder().encode(value))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')

/**
 * Byte arrays cross this boundary as JSON arrays of numbers, never `{$u8}`
 * and never base64 — the provider does `getJSONArray("privateKey")`.
 */
export const toNativeByteArray = (bytes: Uint8Array): number[] =>
    Array.from(bytes)

/**
 * Seals a record into the envelope the provider can decrypt.
 *
 * Splitting the trailing 16 bytes of the ciphertext back out into `tag` is
 * the whole point: Subtle appends the GCM tag, the provider expects it
 * separately.
 */
export const sealNativeCredentialRecord = async (
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
    })
}
