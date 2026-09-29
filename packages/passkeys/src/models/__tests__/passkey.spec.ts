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

import { describe, expect, it, vi } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'

// The keystore's package root pulls react-native-mmkv, which has no loadable
// build here — but `dist/storage/driver.js`, where the marker is defined, only
// imports keystore-core and @scure/base. Same technique as
// `extensions/provider`'s migration specs.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return { PASSKEY_MIGRATION_NEEDED: driver.PASSKEY_MIGRATION_NEEDED }
})

import { PASSKEY_MIGRATION_NEEDED as UPSTREAM_MARKER } from '@algorandfoundation/react-native-keystore'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'
import {
    credentialToPasskey,
    keyToPasskey,
    PASSKEY_MIGRATION_NEEDED,
} from '../passkey'
import { fromStandardBase64 } from '../../native/nativeProviderRecord'

const buildPasskeyKey = (metadata: Record<string, unknown>): Key =>
    ({
        id: 'cred-id-1',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        metadata,
    }) as Key

/**
 * `k/` as Pera's patch of the Android provider writes it: org.json output of
 * `saveCredential` then `recordCredentialUsage`, which escapes `/` as `\/`.
 */
const ANDROID_K_RECORD = String.raw`{"id":"+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/+\/8=","type":"hd-derived-p256","algorithm":"P256","extractable":false,"keyUsages":["sign"],"name":"Passkey: https:\/\/webauthn.io","publicKey":{"$u8":"BAQEBA=="},"metadata":{"origin":"https:\/\/webauthn.io","userHandle":"alice","userId":"dXNlcg","count":3,"parentKeyId":"hd-1-passkey-main","scheme":"pbkdf2-p256","derivationVersion":1,"lastUsedAt":1727259000000},"privateKeyEnc":{"iv":"AAAAAAAAAAAAAAAA"}}`

/** Parses a `k/` record the way keystore hydration does: `$u8` back to bytes. */
const parseKeyRecord = (raw: string): Key =>
    JSON.parse(raw, (_field, value) =>
        value && typeof value === 'object' && typeof value.$u8 === 'string'
            ? fromStandardBase64(value.$u8)
            : value,
    ) as Key

const buildNativeCredential = (
    overrides: Partial<NativeStoredCredential>,
): NativeStoredCredential =>
    ({
        credentialId: 'cred-id-1',
        rpId: 'webauthn.io',
        userHandle: 'will-android-pera7',
        ...overrides,
    }) as NativeStoredCredential

// toUrlSafeBase64 unit tests live in @perawallet/wallet-core-shared
// (utils/__tests__/strings.spec.ts) — the helper moved there.

// The restated copy in `../passkey` is what the model compares against; this
// is the only thing standing between it and silent drift from the keystore.
it('restates the keystore marker exactly', () => {
    expect(PASSKEY_MIGRATION_NEEDED).toBe(UPSTREAM_MARKER)
})

describe('keyToPasskey', () => {
    it('uses the native userHandle (WebAuthn user.name) as the display name when no explicit name is stored', () => {
        const passkey = keyToPasskey(
            buildPasskeyKey({
                origin: 'webauthn.io',
                userHandle: 'will-android-pera7',
            }),
        )

        expect(passkey?.displayName).toBe('will-android-pera7')
        expect(passkey?.origin).toBe('webauthn.io')
    })

    it('prefers an explicit displayName/name over the userHandle fallback', () => {
        const passkey = keyToPasskey(
            buildPasskeyKey({
                origin: 'webauthn.io',
                userHandle: 'will-android-pera7',
                displayName: 'Will Beaumont',
            }),
        )

        expect(passkey?.displayName).toBe('Will Beaumont')
    })

    it('returns null when required passkey metadata (origin/userHandle) is missing', () => {
        expect(
            keyToPasskey(buildPasskeyKey({ origin: 'webauthn.io' })),
        ).toBeNull()
    })

    it('marks a record the keystore flagged as needing migration', () => {
        const passkey = keyToPasskey(
            buildPasskeyKey({
                origin: 'webauthn.io',
                userHandle: 'will-android-pera7',
                migration: PASSKEY_MIGRATION_NEEDED,
            }),
        )

        expect(passkey?.needsMigration).toBe(true)
    })

    it('does not mark a new-scheme pbkdf2-p256 credential, which upstream never flags', () => {
        const passkey = keyToPasskey(
            buildPasskeyKey({
                origin: 'webauthn.io',
                userHandle: 'will-android-pera7',
                scheme: 'pbkdf2-p256',
            }),
        )

        expect(passkey?.needsMigration).toBe(false)
    })

    it('does not mark a record whose migration marker is some other value', () => {
        const passkey = keyToPasskey(
            buildPasskeyKey({
                origin: 'webauthn.io',
                userHandle: 'will-android-pera7',
                migration: 'completed',
            }),
        )

        expect(passkey?.needsMigration).toBe(false)
    })

    // A `k/` record JS cannot read fails hydration at the next cold start, so
    // the Android provider's own output is pinned from the JS side.
    it('reads the k/ record the Android provider writes', () => {
        const passkey = keyToPasskey(parseKeyRecord(ANDROID_K_RECORD))

        expect(passkey).toMatchObject({
            origin: 'https://webauthn.io',
            userHandle: 'alice',
            lastUsedAt: 1727259000000,
            needsMigration: false,
            source: 'keystore',
        })
    })
})

describe('credentialToPasskey', () => {
    it('uses the userHandle (WebAuthn user.name) as the display name when the platform supplies no explicit name', () => {
        const passkey = credentialToPasskey(
            buildNativeCredential({ name: undefined, userName: undefined }),
        )

        expect(passkey?.displayName).toBe('will-android-pera7')
        expect(passkey?.origin).toBe('webauthn.io')
    })

    it('prefers an explicit userName over the userHandle fallback', () => {
        const passkey = credentialToPasskey(
            buildNativeCredential({
                name: undefined,
                userName: 'alice@example.com',
                userHandle: 'opaque-handle',
            }),
        )

        expect(passkey?.displayName).toBe('alice@example.com')
    })

    it('prefers an explicit name over userName and userHandle', () => {
        const passkey = credentialToPasskey(
            buildNativeCredential({
                name: 'Alice Smith',
                userName: 'alice@example.com',
            }),
        )

        expect(passkey?.displayName).toBe('Alice Smith')
    })
})
