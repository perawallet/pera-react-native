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
import {
    AppError,
    ErrorCategory,
    isExpectedError,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'
import { BackupSyncQrError } from '../cloud/crypto/syncQrPayload'
import { ItemKeyHasherDisposedError } from '../cloud/crypto/itemKeyHash'
import { DecryptItemPayloadError } from '../cloud/crypto/itemPayload'
import { BackupResponseParseError } from '../cloud/api/responseParsers'
import { FromSeqTooOldError } from '../cloud/api/endpoints'
import { BackupPayloadParseError } from '../cloud/api/payloadParsers'
import { BackupAuthKeyMissingError } from '../cloud/api/signedRequest'
import {
    BackupPushIncompleteError,
    BackupSyncAbortedError,
    UnsupportedBackupAccountTypeError,
} from '../cloud/sync/types'
import { CloudBackupRestoreError } from '../cloud/restore/restoreCloudBackup'
import { SecureBackupImportError } from '../secure-backup/errors'
import { BackupMnemonicParseError } from '../cloud/credentials/keyStorage'
import { PeraWebImportError } from '../peraweb/errors'
import { createEmptySyncState } from '../cloud/models/syncState'

type Row = [string, () => AppError, ErrorCategory]

const rows: Row[] = [
    ['BackupSyncQrError', () => new BackupSyncQrError(), ErrorCategory.STORAGE],
    [
        'ItemKeyHasherDisposedError',
        () => new ItemKeyHasherDisposedError(),
        ErrorCategory.STORAGE,
    ],
    [
        'DecryptItemPayloadError',
        () => new DecryptItemPayloadError(),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupResponseParseError',
        () => new BackupResponseParseError('bad'),
        ErrorCategory.STORAGE,
    ],
    [
        'FromSeqTooOldError',
        () => new FromSeqTooOldError(7),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupPayloadParseError',
        () => new BackupPayloadParseError('bad'),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupAuthKeyMissingError',
        () => new BackupAuthKeyMissingError(),
        ErrorCategory.STORAGE,
    ],
    [
        'UnsupportedBackupAccountTypeError',
        () => new UnsupportedBackupAccountTypeError('x', 'algorand'),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupSyncAbortedError',
        () => new BackupSyncAbortedError(),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupPushIncompleteError',
        () =>
            new BackupPushIncompleteError(
                createEmptySyncState('backup-1'),
                new Error('boom'),
            ),
        ErrorCategory.STORAGE,
    ],
    [
        'CloudBackupRestoreError',
        () => new CloudBackupRestoreError('UNKNOWN'),
        ErrorCategory.STORAGE,
    ],
    [
        'SecureBackupImportError',
        () => new SecureBackupImportError('empty_file'),
        ErrorCategory.STORAGE,
    ],
    [
        'BackupMnemonicParseError',
        () => new BackupMnemonicParseError(),
        ErrorCategory.STORAGE,
    ],
    [
        'PeraWebImportError',
        () => new PeraWebImportError('malformed_qr'),
        ErrorCategory.STORAGE,
    ],
]

describe('backup domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('keeps the seq a changelog no longer reaches', () => {
        expect(new FromSeqTooOldError(7).fromSeq).toBe(7)
    })

    it('keeps the type and chain of an unsupported account item', () => {
        const error = new UnsupportedBackupAccountTypeError('hd', 'algorand')

        expect(error.type).toBe('hd')
        expect(error.chainId).toBe('algorand')
    })

    it('keeps the reason of a secure backup import failure and defaults the message to it', () => {
        const error = new SecureBackupImportError('empty_file')

        expect(error.reason).toBe('empty_file')
        expect(error.message).toBe('empty_file')
    })

    it('keeps the reason of a Pera Web import failure and defaults the message to it', () => {
        const error = new PeraWebImportError('malformed_qr')

        expect(error.reason).toBe('malformed_qr')
        expect(error.message).toBe('malformed_qr')
    })

    it('keeps the cause chain of a restore failure that has an Error cause', () => {
        const inner = new Error('inner')

        const error = new CloudBackupRestoreError('NOT_FOUND', inner)

        expect(error.category).toBe('NOT_FOUND')
        expect(error.cause).toBe(inner)
        expect(error.originalError).toBe(inner)
    })

    it('keeps a non-Error cause without treating it as the original error', () => {
        const error = new CloudBackupRestoreError('UNKNOWN', 'text')

        expect(error.cause).toBe('text')
        expect(error.originalError).toBeUndefined()
    })

    it('stays expected when the push failed on a raw network error', () => {
        const state = createEmptySyncState('backup-1')

        const error = new BackupPushIncompleteError(
            state,
            new Error('fetch failed'),
        )

        expect(error.state).toBe(state)
        expect(error.message).toContain('fetch failed')
        expect(isExpectedError(error)).toBe(true)
    })

    it('takes the expected verdict of a wrapped network error', () => {
        const error = new BackupPushIncompleteError(
            createEmptySyncState('backup-1'),
            new PeraNetworkError('server', { status: 503 }),
        )

        expect(isExpectedError(error)).toBe(true)
    })

    it('keeps the cause chain of the error the push failed on', () => {
        const inner = new PeraNetworkError('server', { status: 503 })

        const error = new BackupPushIncompleteError(
            createEmptySyncState('backup-1'),
            inner,
        )

        expect(error.cause).toBe(inner)
        expect(error.originalError).toBe(inner)
    })

    it('keeps a non-Error push failure as the cause only', () => {
        const error = new BackupPushIncompleteError(
            createEmptySyncState('backup-1'),
            'text',
        )

        expect(error.cause).toBe('text')
        expect(error.originalError).toBeUndefined()
    })

    it('is reported when the push failed on an unexpected error', () => {
        const error = new BackupPushIncompleteError(
            createEmptySyncState('backup-1'),
            new Error('boom'),
        )

        expect(isExpectedError(error)).toBe(false)
    })
})
