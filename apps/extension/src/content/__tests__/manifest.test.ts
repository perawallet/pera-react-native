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
}

// vitest's root for this package is apps/extension/ (see vitest.config.ts),
// so resolve relative to the process cwd rather than import.meta.url — the
// latter isn't reliably a `file:` URL once esbuild transforms this file.
const manifestPath = path.resolve(process.cwd(), 'manifest.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
    content_scripts: ContentScriptEntry[]
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
