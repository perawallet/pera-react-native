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

// The global mock of `@perawallet/wallet-core-shared` (see
// `apps/mobile/vitest.setup.ts`) is intentionally minimal and omits
// `decodeFromBase64`/`encodeToBase64`. The Pera Web QR parser depends on
// the real base64 decoder; layer those onto the global mock here.
import { vi } from 'vitest'

vi.mock('@perawallet/wallet-core-shared', async () => {
    const original = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...original,
        // Keep the mocked logger so other modules that read `logger.warn`
        // etc. don't blow up under jsdom.
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }
})

import { parseDeeplink } from '../parser'
import { parseDevLocaleTourUri } from '../dev-locale-tour-parser'

import { DeeplinkType } from '../types'

// Test addresses from CSV
const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

describe('Deeplink Parser - Main Parser', () => {
    it('returns null for invalid URL', () => {
        expect(parseDeeplink('')).toBeNull()
        expect(parseDeeplink('invalid')).toBeNull()
        expect(parseDeeplink('http://google.com')).toBeNull()
    })

    it('routes to Coinbase parser for algo: scheme', () => {
        const result = parseDeeplink(
            `algo:31566704/transfer?address=${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.ASSET_TRANSFER)
    })

    it('routes to new format parser for /app/ URLs', () => {
        const result = parseDeeplink(
            `perawallet://app/add-contact/?address=${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.ADD_CONTACT)
    })

    it('routes to old format parser for perawallet://', () => {
        const result = parseDeeplink(`perawallet://${TEST_ADDRESS}`)
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
    })

    it('routes to wallet connect format parser for wc://', () => {
        const result = parseDeeplink('wc:test@1?bridge=test&key=test')
        expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
    })

    it('handles HTTPS app links', () => {
        const result = parseDeeplink(
            `https://perawallet.app/qr/perawallet/app/swap/?address=${TEST_ADDRESS}&assetInId=0&assetOutId=31566704`,
        )
        expect(result?.type).toBe(DeeplinkType.SWAP)
    })

    it('handles HTTPS old format links', () => {
        const result = parseDeeplink(
            `https://perawallet.app/qr/perawallet/${TEST_ADDRESS}`,
        )
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
    })

    it('returns null for unknown HTTPS links', () => {
        expect(parseDeeplink('https://perawallet.app/unknown')).toBeNull()
    })

    it('routes to wallet connect parser for perawallet-wc://', () => {
        const result = parseDeeplink(
            'perawallet-wc:test@1?bridge=test&key=test',
        )
        expect(result?.type).toBe(DeeplinkType.WALLET_CONNECT)
    })

    it('routes to algorand parser for algorand://', () => {
        const result = parseDeeplink(`algorand://${TEST_ADDRESS}`)
        expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
    })

    it('parses fido:// URLs as LIQUID_AUTH with fido variant', () => {
        const url = 'fido://example.com/auth?challenge=abc'
        const result = parseDeeplink(url)
        expect(result?.type).toBe(DeeplinkType.LIQUID_AUTH)
        if (result?.type === DeeplinkType.LIQUID_AUTH) {
            expect(result.variant).toBe('fido')
            expect(result.url).toBe(url)
            expect(result.sourceUrl).toBe(url)
        }
    })

    it('parses liquid:// URLs as LIQUID_AUTH with liquid variant', () => {
        const url = 'liquid://example.com/session?id=abc'
        const result = parseDeeplink(url)
        expect(result?.type).toBe(DeeplinkType.LIQUID_AUTH)
        if (result?.type === DeeplinkType.LIQUID_AUTH) {
            expect(result.variant).toBe('liquid')
            expect(result.url).toBe(url)
            expect(result.sourceUrl).toBe(url)
        }
    })
})

describe('Deeplink Parser - Edge Cases', () => {
    it('handles missing required parameters', () => {
        // Falls back to HOME via old parser
        const result1 = parseDeeplink('perawallet://app/add-contact/')
        expect(result1).toBeDefined()
        expect(result1?.type).toBe(DeeplinkType.HOME)

        const result2 = parseDeeplink('perawallet://app/asset-transfer/')
        expect(result2).toBeDefined()
        expect(result2?.type).toBe(DeeplinkType.HOME)
    })

    it('handles undefined deeplinks', () => {
        const result = parseDeeplink('perawallet://undefined')
        // Returns HOME as graceful fallback for unknown paths
        expect(result).toBeDefined()
        expect(result?.type).toBe(DeeplinkType.HOME)
    })

    it('handles malformed URLs gracefully', () => {
        // Empty deep link returns HOME
        expect(parseDeeplink('perawallet://')).toBeDefined()
        expect(parseDeeplink('perawallet://')?.type).toBe(DeeplinkType.HOME)
        // Unknown path returns HOME as fallback
        expect(parseDeeplink('perawallet://app/unknown-path/')).toBeDefined()
        expect(parseDeeplink('perawallet://app/unknown-path/')?.type).toBe(
            DeeplinkType.HOME,
        )
    })

    describe('Pera Web import (JSON QR)', () => {
        // 32-byte base64 secretbox key. Stable across tests so we can
        // assert byte-for-byte equality on the decoded result.
        const KEY = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1))
        const KEY_B64 = Buffer.from(KEY).toString('base64')

        it('recognizes a Pera Web QR JSON as PERA_WEB_IMPORT', () => {
            const qr = JSON.stringify({
                backupId: 'backup-abc',
                encryptionKey: KEY_B64,
                version: '1',
                action: 'import',
            })

            const result = parseDeeplink(qr)
            expect(result?.type).toBe(DeeplinkType.PERA_WEB_IMPORT)
            if (result?.type === DeeplinkType.PERA_WEB_IMPORT) {
                expect(result.backupId).toBe('backup-abc')
                expect(Array.from(result.encryptionKey)).toEqual(
                    Array.from(KEY),
                )
            }
        })

        it('returns null for JSON that is not a Pera Web QR (no relevant fields)', () => {
            // JSON-shaped but missing the required fields — the parser
            // returns null so the QR scanner re-arms silently rather than
            // dispatching a malformed deeplink.
            expect(parseDeeplink('{"foo":"bar"}')).toBeNull()
        })

        it('returns null for a Pera Web JSON QR with an unsupported version', () => {
            const qr = JSON.stringify({
                backupId: 'b',
                encryptionKey: KEY_B64,
                version: '99',
            })
            // Version mismatches surface as null at the parser layer; the
            // scanner treats this the same as "unrecognized QR" and
            // re-arms, mirroring the broader app pattern for unknown
            // codes.
            expect(parseDeeplink(qr)).toBeNull()
        })

        it('returns null for non-JSON QRs to keep the JSON sniff cheap', () => {
            // A QR that doesn't start with `{` shouldn't be JSON.parsed at
            // all — verifies the early-exit sniff in `parsePeraWebJsonQr`.
            expect(parseDeeplink('not json at all')).toBeNull()
        })
    })

    describe('legacy recover-account (mnemonic JSON QR)', () => {
        it('extracts the mnemonic but never echoes the payload into sourceUrl', () => {
            const mnemonic = new Array(25).fill('word').join(' ')
            const qr = JSON.stringify({ version: 1, mnemonic })

            const result = parseDeeplink(qr)

            expect(result?.type).toBe(DeeplinkType.RECOVER_ADDRESS)
            if (result?.type === DeeplinkType.RECOVER_ADDRESS) {
                expect(result.mnemonic).toBe(mnemonic)
                // The raw payload IS the secret — it must not survive on the
                // parsed deeplink where a logger / error sheet could read it.
                expect(result.sourceUrl).toBe('')
            }
        })
    })
})

// metro.config.js resolves this parser to a stub outside dev bundles, so there
// is no runtime gate left to assert here — vitest always loads the real module
// (it resolves through tsconfig paths, not Metro). See stubs.spec.ts.
describe('Deeplink Parser - dev locale tour', () => {
    it('parses a per-step locale-tour deeplink', () => {
        const parsed = parseDeeplink(
            'perawallet://app/dev/locale-tour?locale=en-XA&step=scr-home',
        )

        expect(parsed?.type).toBe('DEV_LOCALE_TOUR')
        if (parsed?.type === 'DEV_LOCALE_TOUR') {
            expect(parsed.locale).toBe('en-XA')
            expect(parsed.step).toBe('scr-home')
        }
    })

    it('rejects a missing or empty step at the parse boundary', () => {
        // The dev-locale-tour parser itself rejects at the boundary (returns
        // null) — the strict assertion. `parseDeeplink` then falls through
        // to the old parser's safe HOME no-op rather than forming a
        // half-parsed DEV_LOCALE_TOUR deeplink, same as every other
        // missing/invalid-param case on this `perawallet://app/...` scheme
        // (see new-parser.test.ts's non-numeric-asset-id tests).
        expect(
            parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?locale=en-XA',
            ),
        ).toBeNull()
        expect(
            parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?locale=en-XA&step=',
            ),
        ).toBeNull()
        expect(
            parseDeeplink('perawallet://app/dev/locale-tour?locale=en-XA')
                ?.type,
        ).toBe(DeeplinkType.HOME)
    })

    it('rejects a locale that is not a registered i18next resource', () => {
        // 'de' isn't in SUPPORTED_LOCALES today (i18n/locales.ts — only
        // 'en' and the dev pseudolocale are) — an unrecognized locale is
        // unrecognized input, not a partially-parsed deeplink.
        expect(
            parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?locale=de&step=scr-home',
            ),
        ).toBeNull()
        expect(
            parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?step=scr-home',
            ),
        ).toBeNull()
        expect(
            parseDeeplink(
                'perawallet://app/dev/locale-tour?locale=de&step=scr-home',
            )?.type,
        ).toBe(DeeplinkType.HOME)
    })

    it('parses a run-all locale-tour deeplink', () => {
        const parsed = parseDeeplink(
            'perawallet://app/dev/locale-tour?locale=en-XA&run=all',
        )

        expect(parsed?.type).toBe('DEV_LOCALE_TOUR')
        if (parsed?.type === 'DEV_LOCALE_TOUR') {
            expect(parsed.locale).toBe('en-XA')
            expect(parsed.run).toBe('all')
            expect(parsed.step).toBeUndefined()
        }
    })

    it('still parses the existing per-step form alongside the new run-all form', () => {
        const parsed = parseDeeplink(
            'perawallet://app/dev/locale-tour?locale=en-XA&step=scr-home',
        )

        expect(parsed?.type).toBe('DEV_LOCALE_TOUR')
        if (parsed?.type === 'DEV_LOCALE_TOUR') {
            expect(parsed.step).toBe('scr-home')
            expect(parsed.run).toBeUndefined()
        }
    })

    it('rejects a URL with neither step nor run as unrecognized input', () => {
        expect(
            parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?locale=en-XA',
            ),
        ).toBeNull()
        expect(
            parseDeeplink('perawallet://app/dev/locale-tour?locale=en-XA')
                ?.type,
        ).toBe(DeeplinkType.HOME)
    })
})
