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

// A user setting rather than a fault, so it files no crash report.
export class ICloudUnavailableError extends AppError {
    constructor(message = 'iCloud is not available on this device') {
        super(message, {
            category: ErrorCategory.STORAGE,
            severity: ErrorSeverity.LOW,
            expected: true,
            titleKey: 'cloud_backup.store_credentials.icloud_unavailable_title',
            messageKey: 'cloud_backup.store_credentials.icloud_unavailable',
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
            messageKey:
                'cloud_backup.store_credentials.google_drive_unavailable',
        })
    }
}
