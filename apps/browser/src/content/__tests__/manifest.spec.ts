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

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

type ContentScriptEntry = {
    matches: string[]
    js: string[]
    all_frames?: boolean
}

// vitest's root for this package is apps/browser/ (see vitest.config.ts),
// so resolve relative to the process cwd rather than import.meta.url — the
// latter isn't reliably a `file:` URL once esbuild transforms this file.
const manifestPath = path.resolve(process.cwd(), 'manifest.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    content_scripts: ContentScriptEntry[]
    permissions: string[]
    host_permissions: string[]
}

const discoverBidaliEntries = manifest.content_scripts.filter(entry =>
    entry.js.some(js => js.includes('discover') || js.includes('bidali')),
)

// The exact hosts these two surfaces actually load, derived from
// packages/config/src/main.ts (discoverBaseUrl, mainnet/testnet
// bidaliBaseUrl) and the verified 302-redirect twin documented in
// apps/mobile/src/modules/webview/hooks/trusted-iframe-origins.web.ts.
const EXPECTED_HOSTS = [
    'https://discover-mobile.perawallet.app/*',
    'https://discover-mobile-staging.perawallet.app/*',
    'https://commerce.bidali.com/*',
    'https://commerce.staging.bidali.com/*',
    'https://giftcards.bidali.com/*',
    'https://giftcards.staging.bidali.com/*',
]

describe('manifest.json Discover/Bidali content scripts', () => {
    it('registers exactly the 4 Discover/Bidali content-script entries', () => {
        expect(discoverBidaliEntries).toHaveLength(4)
    })

    it('does not match a wildcard host on any Discover/Bidali entry', () => {
        for (const entry of discoverBidaliEntries) {
            for (const match of entry.matches) {
                expect(match.startsWith('https://*.')).toBe(false)
            }
        }
    })

    it.each(EXPECTED_HOSTS)('covers the exact host %s', expectedHost => {
        const isCovered = discoverBidaliEntries.some(entry =>
            entry.matches.includes(expectedHost),
        )
        expect(isCovered).toBe(true)
    })

    it('keeps all_frames: true unchanged on all 4 entries', () => {
        for (const entry of manifest.content_scripts) {
            if (
                entry.js.some(
                    js => js.includes('discover') || js.includes('bidali'),
                )
            ) {
                expect(
                    (entry as unknown as { all_frames: boolean }).all_frames,
                ).toBe(true)
            }
        }
    })
})

const integrityEntries = manifest.content_scripts.filter(entry =>
    entry.js.includes('content-integrity-check.js'),
)

describe('manifest.json integrity check content script', () => {
    it('registers exactly one entry', () => {
        expect(integrityEntries).toHaveLength(1)
    })

    it('matches exactly the two check page hosts', () => {
        expect(integrityEntries[0]?.matches).toEqual([
            'https://integrity.perawallet.app/*',
            'https://integrity-staging.perawallet.app/*',
        ])
    })

    it('runs isolated, at document start, in every frame', () => {
        expect(integrityEntries[0]).toMatchObject({
            run_at: 'document_start',
            world: 'ISOLATED',
            all_frames: true,
        })
    })
})

// Loopback is the browser's own secure-context carve-out, so it's the only
// plaintext host we inject into. Anything else over http:// would let an
// on-path attacker reach the dapp/WebAuthn relays for a domain whose real
// credentials and grants live on https — see
// packages/browser-runtime/src/dapp/secure-origin.ts for the full rationale.
const ALLOWED_PLAINTEXT_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*']

describe('manifest.json secure-origin posture', () => {
    it('never injects into plaintext http:// beyond loopback', () => {
        for (const entry of manifest.content_scripts) {
            for (const match of entry.matches) {
                if (!match.startsWith('http://')) continue
                expect(ALLOWED_PLAINTEXT_MATCHES).toContain(match)
            }
        }
    })

    // A framed wrapper would pre-empt the browser's publickey-credentials-*
    // Permissions-Policy gate and report the ceremony as top-level.
    it('injects the WebAuthn pair into the top frame only', () => {
        const webauthnEntries = manifest.content_scripts.filter(entry =>
            entry.js.some(js => js.includes('webauthn')),
        )
        expect(webauthnEntries).toHaveLength(2)
        for (const entry of webauthnEntries) {
            expect(entry.all_frames).toBe(false)
        }
    })

    it('keeps the dapp and WebAuthn relays on https', () => {
        const pageFacing = manifest.content_scripts.filter(entry =>
            entry.js.some(
                js => js.includes('inject-main') || js.includes('webauthn'),
            ),
        )
        expect(pageFacing.length).toBeGreaterThan(0)
        for (const entry of pageFacing) {
            expect(entry.matches).toContain('https://*/*')
        }
    })
})

describe('manifest.json push notification requirements', () => {
    // Without `notifications`, pushManager.subscribe({ userVisibleOnly: true })
    // throws NotAllowedError — and the FCM SDK hardcodes that flag, so dropping
    // this permission silently kills token acquisition.
    it('declares the notifications permission', () => {
        expect(manifest.permissions).toContain('notifications')
    })

    it('allows the FCM token registration host', () => {
        expect(manifest.host_permissions).toContain(
            'https://fcmregistrations.googleapis.com/*',
        )
    })
})
