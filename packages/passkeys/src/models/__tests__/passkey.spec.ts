/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import type { Key } from '@algorandfoundation/keystore'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'
import { credentialToPasskey, keyToPasskey, toUrlSafeBase64 } from '../passkey'

const buildPasskeyKey = (metadata: Record<string, unknown>): Key =>
    ({
        id: 'cred-id-1',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        metadata,
    }) as Key

const buildNativeCredential = (
    overrides: Partial<NativeStoredCredential>,
): NativeStoredCredential =>
    ({
        credentialId: 'cred-id-1',
        rpId: 'webauthn.io',
        userHandle: 'will-android-pera7',
        ...overrides,
    }) as NativeStoredCredential

describe('toUrlSafeBase64', () => {
    it('replaces + and / with url-safe characters and strips trailing padding', () => {
        expect(toUrlSafeBase64('ab+/cd==')).toBe('ab-_cd')
    })

    it('leaves a fully padding-free string unchanged aside from char swaps', () => {
        expect(toUrlSafeBase64('abcd')).toBe('abcd')
    })

    it('only strips trailing padding, not interior = characters', () => {
        expect(toUrlSafeBase64('a=b=')).toBe('a=b')
    })
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
