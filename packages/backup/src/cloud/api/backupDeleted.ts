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
    isPeraNetworkError,
    type PeraNetworkError,
} from '@perawallet/wallet-core-shared'

/** What the backup server answers a correctly signed request for a deleted backup with. */
export const BACKUP_DELETED_STATUS = 410

/** Tells the deleted-backup 410 apart from `/delta`'s 410 `FROM_SEQ_TOO_OLD`. */
export const BACKUP_DELETED_CODE = 'BACKUP_DELETED'

/** Acting on it deletes the backup keys, so it never matches a bare 401 or an uncoded 410. */
export const isBackupDeletedError = (
    error: unknown,
): error is PeraNetworkError =>
    isPeraNetworkError(error) &&
    error.status === BACKUP_DELETED_STATUS &&
    error.backendCode === BACKUP_DELETED_CODE
