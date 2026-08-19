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

import { describe, expect, it } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { parsePeraWebImportFields } from '../parse-import-fields'
import { PeraWebImportError, PeraWebImportErrorReason } from '../../errors'

const KEY_BYTES = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i))
const KEY_B64 = encodeToBase64(KEY_BYTES)
const KEY_COMMA = Array.from(KEY_BYTES).join(',')

const expectReason = (
    fn: () => unknown,
    reason: PeraWebImportErrorReason,
): void => {
    try {
        fn()
        expect.unreachable('expected PeraWebImportError')
    } catch (error) {
        expect(error).toBeInstanceOf(PeraWebImportError)
        expect((error as PeraWebImportError).reason).toBe(reason)
    }
}

describe('parsePeraWebImportFields', () => {
    it('accepts a base64 key and returns decoded bytes', () => {
        const result = parsePeraWebImportFields({
            backupId: 'abc-123_XYZ',
            encryptionKey: KEY_B64,
        })
        expect(result.backupId).toBe('abc-123_XYZ')
        expect(result.encryptionKey).toEqual(KEY_BYTES)
    })

    it('accepts the legacy comma-separated decimal key', () => {
        const result = parsePeraWebImportFields({
            backupId: 'abc',
            encryptionKey: KEY_COMMA,
        })
        expect(result.encryptionKey).toEqual(KEY_BYTES)
    })

    it('accepts version "1" and action "import"', () => {
        const result = parsePeraWebImportFields({
            backupId: 'abc',
            encryptionKey: KEY_B64,
            version: '1',
            action: 'import',
        })
        expect(result.backupId).toBe('abc')
    })

    it.each([
        ['missing', undefined],
        ['empty', ''],
        ['bad charset', 'has/slash'],
        ['oversize', 'a'.repeat(129)],
        ['non-string', 42],
    ])('rejects %s backupId as MalformedQr', (_label, backupId) => {
        expectReason(
            () =>
                parsePeraWebImportFields({
                    backupId,
                    encryptionKey: KEY_B64,
                }),
            PeraWebImportErrorReason.MalformedQr,
        )
    })

    it('rejects a missing encryption key as MalformedQr', () => {
        expectReason(
            () =>
                parsePeraWebImportFields({
                    backupId: 'abc',
                    encryptionKey: undefined,
                }),
            PeraWebImportErrorReason.MalformedQr,
        )
    })

    it('rejects a wrong-length key as MalformedQr', () => {
        expectReason(
            () =>
                parsePeraWebImportFields({
                    backupId: 'abc',
                    encryptionKey: encodeToBase64(new Uint8Array(16)),
                }),
            PeraWebImportErrorReason.MalformedQr,
        )
    })

    it.each([['2'], [1]])(
        'rejects version %s as UnsupportedVersion',
        version => {
            expectReason(
                () =>
                    parsePeraWebImportFields({
                        backupId: 'abc',
                        encryptionKey: KEY_B64,
                        version,
                    }),
                PeraWebImportErrorReason.UnsupportedVersion,
            )
        },
    )

    it('rejects an unknown action as UnsupportedAction', () => {
        expectReason(
            () =>
                parsePeraWebImportFields({
                    backupId: 'abc',
                    encryptionKey: KEY_B64,
                    action: 'modify',
                }),
            PeraWebImportErrorReason.UnsupportedAction,
        )
    })

    it('checks backupId before version (error precedence preserved)', () => {
        expectReason(
            () =>
                parsePeraWebImportFields({
                    backupId: '',
                    encryptionKey: KEY_B64,
                    version: '2',
                }),
            PeraWebImportErrorReason.MalformedQr,
        )
    })
})
