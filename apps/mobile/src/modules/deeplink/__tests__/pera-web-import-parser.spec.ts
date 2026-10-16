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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { DeeplinkType } from '@perawallet/wallet-core-deeplinks'
import { parsePeraWebImportLink } from '../pera-web-import-parser'

describe('parsePeraWebImportLink', () => {
    describe('JSON QR', () => {
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

            const result = parsePeraWebImportLink(qr)
            expect(result?.type).toBe(DeeplinkType.PERA_WEB_IMPORT)
            if (result) {
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
            expect(parsePeraWebImportLink('{"foo":"bar"}')).toBeNull()
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
            expect(parsePeraWebImportLink(qr)).toBeNull()
        })

        it('returns null for non-JSON QRs to keep the JSON sniff cheap', () => {
            // A QR that doesn't start with `{` shouldn't be JSON.parsed at
            // all — verifies the early-exit sniff.
            expect(parsePeraWebImportLink('not json at all')).toBeNull()
        })
    })

    describe('web-import app action', () => {
        const WEB_IMPORT_KEY_BYTES = Uint8Array.from(
            Array.from({ length: 32 }, (_, i) => i),
        )
        const WEB_IMPORT_KEY_B64 =
            Buffer.from(WEB_IMPORT_KEY_BYTES).toString('base64')

        it('parses the app-action form with a percent-encoded base64 key', () => {
            const result = parsePeraWebImportLink(
                `perawallet://app/web-import/?backupId=abc-123_XYZ&encryptionKey=${encodeURIComponent(
                    WEB_IMPORT_KEY_B64,
                )}&action=import`,
            )
            expect(result?.type).toBe(DeeplinkType.PERA_WEB_IMPORT)
            if (result?.type === DeeplinkType.PERA_WEB_IMPORT) {
                expect(result.backupId).toBe('abc-123_XYZ')
                expect(result.encryptionKey).toEqual(WEB_IMPORT_KEY_BYTES)
                // The URL embeds the secretbox key; the parsed deeplink must
                // never echo it back.
                expect(result.sourceUrl).toBe('')
            }
        })

        it('parses the legacy comma-separated decimal key', () => {
            const commaKey = Array.from(WEB_IMPORT_KEY_BYTES).join(',')
            const result = parsePeraWebImportLink(
                `perawallet://app/web-import/?backupId=abc&encryptionKey=${commaKey}`,
            )
            expect(result?.type).toBe(DeeplinkType.PERA_WEB_IMPORT)
            if (result?.type === DeeplinkType.PERA_WEB_IMPORT) {
                expect(result.encryptionKey).toEqual(WEB_IMPORT_KEY_BYTES)
            }
        })

        it('parses the universal-link form', () => {
            const result = parsePeraWebImportLink(
                `https://perawallet.app/qr/perawallet/app/web-import/?backupId=abc&encryptionKey=${encodeURIComponent(
                    WEB_IMPORT_KEY_B64,
                )}`,
            )
            expect(result?.type).toBe(DeeplinkType.PERA_WEB_IMPORT)
            if (result?.type === DeeplinkType.PERA_WEB_IMPORT) {
                expect(result.sourceUrl).toBe('')
            }
        })

        it('returns null when backupId is missing', () => {
            expect(
                parsePeraWebImportLink(
                    `perawallet://app/web-import/?encryptionKey=${encodeURIComponent(
                        WEB_IMPORT_KEY_B64,
                    )}`,
                ),
            ).toBeNull()
        })

        it('returns null when encryptionKey is missing', () => {
            expect(
                parsePeraWebImportLink(
                    'perawallet://app/web-import/?backupId=abc',
                ),
            ).toBeNull()
        })

        it('returns null for an unknown action', () => {
            expect(
                parsePeraWebImportLink(
                    `perawallet://app/web-import/?backupId=abc&encryptionKey=${encodeURIComponent(
                        WEB_IMPORT_KEY_B64,
                    )}&action=modify`,
                ),
            ).toBeNull()
        })

        it('returns null for an unsupported version', () => {
            expect(
                parsePeraWebImportLink(
                    `perawallet://app/web-import/?backupId=abc&encryptionKey=${encodeURIComponent(
                        WEB_IMPORT_KEY_B64,
                    )}&version=2`,
                ),
            ).toBeNull()
        })

        it('returns null for a wrong-length key', () => {
            expect(
                parsePeraWebImportLink(
                    `perawallet://app/web-import/?backupId=abc&encryptionKey=${encodeURIComponent(
                        Buffer.from(new Uint8Array(16)).toString('base64'),
                    )}`,
                ),
            ).toBeNull()
        })
    })
})
