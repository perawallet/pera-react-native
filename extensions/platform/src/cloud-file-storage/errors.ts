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

import type { CloudFileStore } from './models'

// A user setting rather than a fault, so it files no crash report.
export class ICloudUnavailableError extends AppError {
    constructor(message = 'iCloud is not available on this device') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            titleKey: 'cloud_backup.icloud.unavailable_title',
            messageKey: 'cloud_backup.icloud.unavailable',
        })
    }
}

// A release built without the OAuth client ids is our fault, so it reports.
export class GoogleDriveNotConfiguredError extends AppError {
    constructor(
        message = 'No Google OAuth client is configured for this build',
    ) {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            messageKey: 'cloud_backup.google_drive.unavailable',
        })
    }
}

// A device without current Play Services can't reach Drive at all, so this is a
// device state to explain rather than a fault to report.
export class GooglePlayServicesUnavailableError extends AppError {
    constructor(message = 'Google Play services is unavailable or outdated') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.google_drive.play_services',
        })
    }
}

// Raised only once the one token refresh has already been spent.
export class GoogleDriveAuthFailedError extends AppError {
    constructor(message = 'Google Drive rejected the access token') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.google_drive.sign_in_failed',
        })
    }
}

export class GoogleDriveUnreachableError extends AppError {
    constructor(message = 'Google Drive could not be reached') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.google_drive.unreachable',
        })
    }
}

// The listing already proved the file is there, so this is never "no key": the
// placeholder just hasn't finished downloading within the poll window.
export class CloudFileNotDownloadedError extends AppError {
    constructor(message = 'The file is still downloading') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey: 'cloud_backup.restore.import_still_downloading',
        })
    }
}

export class CloudFileNotFoundError extends AppError {
    constructor(store: CloudFileStore) {
        super(`No matching file in ${store}`, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            messageKey:
                store === 'icloud'
                    ? 'cloud_backup.restore.import_not_found_icloud'
                    : 'cloud_backup.restore.import_not_found_google_drive',
        })
    }
}
