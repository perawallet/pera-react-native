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

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
    clearInstallKey,
    clearEnrolmentMarker,
    exportInstallPublicKey,
    getEnrolmentMarker,
    getInstallKeyId,
    getOrCreateInstallKey,
    putEnrolmentMarker,
    signChallenge,
} from '../device-key'

const fromBase64 = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), char => char.charCodeAt(0))

const toBase64Url = (bytes: ArrayBuffer): string =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

describe('install key', () => {
    beforeEach(() => {
        // Fresh backing store per test; fake-indexeddb keeps databases on the
        // factory, so replacing it is the only reliable reset.
        globalThis.indexedDB = new IDBFactory()
    })

    it('generates a non-extractable private key', async () => {
        const pair = await getOrCreateInstallKey()

        expect(pair.privateKey.extractable).toBe(false)
        await expect(
            crypto.subtle.exportKey('pkcs8', pair.privateKey),
        ).rejects.toThrow()
    })

    it('returns the same key on a second call', async () => {
        const first = await exportInstallPublicKey()
        const second = await exportInstallPublicKey()

        expect(second).toBe(first)
    })

    it('persists across a fresh module instance', async () => {
        const before = await exportInstallPublicKey()

        // A new service-worker generation re-imports the module with the same
        // IndexedDB — the key must survive, not regenerate. A query-suffixed
        // dynamic import doesn't reliably bust the module cache under this
        // repo's vite/vitest setup, so force a real fresh instance instead.
        vi.resetModules()
        const reimported = await import('../device-key')
        const after = await reimported.exportInstallPublicKey()

        expect(after).toBe(before)
    })

    it('produces a 64-byte raw signature that verifies against the public key', async () => {
        const pair = await getOrCreateInstallKey()
        const signature = await signChallenge('challenge-from-backend')

        const raw = fromBase64(signature)
        expect(raw.byteLength).toBe(64)

        const verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pair.publicKey,
            raw,
            new TextEncoder().encode('challenge-from-backend'),
        )
        expect(verified).toBe(true)
    })

    // Mirrors mint()'s exact call pattern on a fresh install: export and sign
    // are fired together, each reaching getOrCreateInstallKey. Without
    // single-flighting, both readonly reads miss the other's uncommitted write,
    // each generates its own keypair, and the exported public key no longer
    // matches the signing private key — so this verify fails.
    it('exports a public key and signs with the SAME keypair on a fresh install', async () => {
        const challenge = 'challenge-from-backend'
        const [publicKey, signature] = await Promise.all([
            exportInstallPublicKey(),
            signChallenge(challenge),
        ])

        const spki = fromBase64(publicKey)
        const importedPublicKey = await crypto.subtle.importKey(
            'spki',
            spki,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify'],
        )
        const verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            importedPublicKey,
            fromBase64(signature),
            new TextEncoder().encode(challenge),
        )
        expect(verified).toBe(true)
    })

    it('produces a different key after clearInstallKey', async () => {
        const before = await exportInstallPublicKey()
        await clearInstallKey()
        const after = await exportInstallPublicKey()

        expect(after).not.toBe(before)
    })
})

describe('install key id', () => {
    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory()
    })

    it('is the unpadded base64url SHA-256 of the exported SPKI', async () => {
        const spki = fromBase64(await exportInstallPublicKey())
        const expected = toBase64Url(
            await crypto.subtle.digest('SHA-256', spki),
        )

        const kid = await getInstallKeyId()

        expect(kid).toBe(expected)
        expect(kid).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it('is stable for the same key', async () => {
        expect(await getInstallKeyId()).toBe(await getInstallKeyId())
    })
})

describe('enrolment marker', () => {
    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory()
    })

    const marker = {
        kid: 'k'.repeat(43),
        enrolledAt: '2026-09-23T10:00:00.000Z',
    }

    it('is absent until written', async () => {
        expect(await getEnrolmentMarker('mainnet')).toBeNull()
    })

    it('round-trips per network', async () => {
        await putEnrolmentMarker('mainnet', marker)

        expect(await getEnrolmentMarker('mainnet')).toEqual(marker)
        expect(await getEnrolmentMarker('testnet')).toBeNull()
    })

    it('clears one network without touching another', async () => {
        await putEnrolmentMarker('mainnet', marker)
        await putEnrolmentMarker('testnet', marker)

        await clearEnrolmentMarker('mainnet')

        expect(await getEnrolmentMarker('mainnet')).toBeNull()
        expect(await getEnrolmentMarker('testnet')).toEqual(marker)
    })

    it('leaves the install key in place', async () => {
        const before = await exportInstallPublicKey()
        await putEnrolmentMarker('mainnet', marker)
        await clearEnrolmentMarker('mainnet')

        expect(await exportInstallPublicKey()).toBe(before)
    })
})
