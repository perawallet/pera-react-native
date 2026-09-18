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

import { describe, expect, test, vi } from 'vitest'
import {
    CredentialsFileNotFoundError,
    GoogleDriveNotConfiguredError,
    ICloudUnavailableError,
    InvalidCredentialsFileError,
    NoBackupCredentialsError,
    UnsupportedCredentialsFileError,
} from '@perawallet/wallet-core-backup'
import { isExpectedError } from '@perawallet/wallet-core-shared'
import { resolveErrorCopy } from '@i18n/resolveErrorCopy'

// The global unit-test stub re-implements AppError as its own class, so an
// error made from this stub's AppError is never `instanceof` the real one
// `isExpectedError` checks against. Use the real package here so both sides
// agree on which AppError is which.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
}))

const t = (key: string) => key
const getAlgodMessage = () => ({ title: 'algod', body: 'algod' })

describe('backup credentials file errors', () => {
    test('iCloud being off names the situation and says what to do', () => {
        expect(
            resolveErrorCopy(
                new ICloudUnavailableError(),
                t,
                'fallback',
                getAlgodMessage,
            ),
        ).toEqual({
            title: 'cloud_backup.store_credentials.icloud_unavailable_title',
            body: 'cloud_backup.store_credentials.icloud_unavailable',
        })
    })

    test('a build without Google OAuth clients keeps the caller title and explains the gap', () => {
        expect(
            resolveErrorCopy(
                new GoogleDriveNotConfiguredError(),
                t,
                'fallback',
                getAlgodMessage,
            ),
        ).toEqual({
            title: 'fallback',
            body: 'cloud_backup.store_credentials.google_drive_unavailable',
        })
    })

    test('iCloud being off is expected, so it files no crash report', () => {
        expect(isExpectedError(new ICloudUnavailableError())).toBe(true)
    })

    test('a build without Google OAuth clients is not expected, so it reports', () => {
        expect(isExpectedError(new GoogleDriveNotConfiguredError())).toBe(false)
    })

    test.each([
        [
            new CredentialsFileNotFoundError('icloud'),
            'cloud_backup.restore.import_not_found_icloud',
        ],
        [
            new CredentialsFileNotFoundError('googleDrive'),
            'cloud_backup.restore.import_not_found_google_drive',
        ],
        [
            new InvalidCredentialsFileError(),
            'cloud_backup.restore.import_invalid_file',
        ],
        [
            new UnsupportedCredentialsFileError(),
            'cloud_backup.restore.import_unsupported_version',
        ],
        [
            new NoBackupCredentialsError(),
            'cloud_backup.store_credentials.no_credentials',
        ],
    ])(
        'a credentials-file problem keeps the caller title, names the problem and files no crash report',
        (error, body) => {
            expect(
                resolveErrorCopy(error, t, 'fallback', getAlgodMessage),
            ).toEqual({ title: 'fallback', body })
            expect(isExpectedError(error)).toBe(true)
        },
    )
})
