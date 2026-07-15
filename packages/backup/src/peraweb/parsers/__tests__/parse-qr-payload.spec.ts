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

import { describe, it, expect } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { PeraWebImportError, PeraWebImportErrorReason } from '../../errors'
import { parsePeraWebQrPayload } from '../parse-qr-payload'

const KEY_BYTES = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1))

describe('parsePeraWebQrPayload', () => {
    it('decodes a minimal Android-shaped QR (backupId + base64 encryptionKey)', () => {
        const qr = JSON.stringify({
            backupId: 'backup-123',
            encryptionKey: encodeToBase64(KEY_BYTES),
        })

        const result = parsePeraWebQrPayload(qr)

        expect(result.backupId).toBe('backup-123')
        expect(Array.from(result.encryptionKey)).toEqual(Array.from(KEY_BYTES))
    })

    it('decodes the legacy iOS comma-separated encryptionKey', () => {
        const qr = JSON.stringify({
            backupId: 'backup-456',
            encryptionKey: Array.from(KEY_BYTES).join(','),
            version: '1',
            action: 'import',
        })

        const result = parsePeraWebQrPayload(qr)

        expect(result.backupId).toBe('backup-456')
        expect(Array.from(result.encryptionKey)).toEqual(Array.from(KEY_BYTES))
    })

    it('accepts the full iOS shape with version + action + modificationKey', () => {
        const qr = JSON.stringify({
            backupId: 'backup-789',
            encryptionKey: encodeToBase64(KEY_BYTES),
            version: '1',
            action: 'import',
            modificationKey: 'unused-by-us',
        })

        const result = parsePeraWebQrPayload(qr)
        expect(result.backupId).toBe('backup-789')
    })

    it('rejects QR strings that are not JSON', () => {
        try {
            parsePeraWebQrPayload('not even json {')
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(PeraWebImportError)
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })

    it('rejects an oversized QR string before parsing (defence-in-depth)', () => {
        try {
            parsePeraWebQrPayload('A'.repeat(8 * 1024 + 1))
            throw new Error('expected throw')
        } catch (e) {
            expect(e).toBeInstanceOf(PeraWebImportError)
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })

    it('rejects payloads missing backupId', () => {
        const qr = JSON.stringify({
            encryptionKey: encodeToBase64(KEY_BYTES),
        })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })

    it('rejects a backupId with path/query metacharacters', () => {
        for (const backupId of ['../secrets', 'a/b', 'id?x=1', 'id#frag']) {
            const qr = JSON.stringify({
                backupId,
                encryptionKey: encodeToBase64(KEY_BYTES),
            })
            try {
                parsePeraWebQrPayload(qr)
                throw new Error(`expected throw for ${backupId}`)
            } catch (e) {
                expect((e as PeraWebImportError).reason).toBe(
                    PeraWebImportErrorReason.MalformedQr,
                )
            }
        }
    })

    it('rejects payloads missing encryptionKey', () => {
        const qr = JSON.stringify({ backupId: 'x' })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })

    it('rejects an encryptionKey of the wrong length', () => {
        // 16 bytes (too short for secretbox)
        const short = encodeToBase64(new Uint8Array(16).fill(1))
        const qr = JSON.stringify({ backupId: 'x', encryptionKey: short })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })

    it('rejects an unsupported version field', () => {
        const qr = JSON.stringify({
            backupId: 'x',
            encryptionKey: encodeToBase64(KEY_BYTES),
            version: '2',
        })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.UnsupportedVersion,
            )
        }
    })

    it('rejects an unsupported action field', () => {
        const qr = JSON.stringify({
            backupId: 'x',
            encryptionKey: encodeToBase64(KEY_BYTES),
            action: 'export',
        })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.UnsupportedAction,
            )
        }
    })

    it('rejects comma-separated bytes outside 0-255', () => {
        const bad = Array.from({ length: 32 }, () => 256).join(',')
        const qr = JSON.stringify({ backupId: 'x', encryptionKey: bad })
        try {
            parsePeraWebQrPayload(qr)
            throw new Error('expected throw')
        } catch (e) {
            expect((e as PeraWebImportError).reason).toBe(
                PeraWebImportErrorReason.MalformedQr,
            )
        }
    })
})
