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

import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

// Raised by the cloud file stores, re-exported under the names the backup
// domain's call sites import them by.
export {
    GoogleDriveAuthFailedError,
    GoogleDriveNotConfiguredError,
    GoogleDriveUnreachableError,
    GooglePlayServicesUnavailableError,
    ICloudUnavailableError,
    CloudFileNotDownloadedError as CredentialsFileNotDownloadedError,
    CloudFileNotFoundError as CredentialsFileNotFoundError,
} from '@perawallet/wallet-extension-platform'

// The backup can be turned off while a sheet or a PIN prompt is still open, so
// reaching the save with nothing to write is a race the user can lose, not a bug.
export class NoBackupCredentialsError extends AppError {
    constructor(message = 'No backup credentials are stored on this device') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.store_credentials.no_credentials',
        })
    }
}

// The draft holding the phrase and the derived keys dies with the setup
// screens, so finding it gone is a race the user can lose, not a defect.
export class BackupDraftMissingError extends AppError {
    constructor(message = 'Cloud backup draft credentials are missing') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.enable.error',
        })
    }
}

// Deliberately not `expected`: registration is addressed to one device, so
// reaching it without an id is our bug and must keep reporting.
export class BackupDeviceIdUnavailableError extends AppError {
    constructor(message = 'Device ID is unavailable') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            messageKey: 'cloud_backup.enable.error',
        })
    }
}

export class InvalidCredentialsFileError extends AppError {
    constructor(message = 'Not a backup credentials file') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.restore.import_invalid_file',
        })
    }
}

export class UnsupportedCredentialsFileError extends AppError {
    constructor(message = 'Backup credentials file needs a newer app') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.restore.import_unsupported_version',
        })
    }
}
