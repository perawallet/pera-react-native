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

import type { BackupItemKey } from './types'

export const BACKUP_ACCOUNTS_KEY_PREFIX = 'accounts/'
export const BACKUP_SECRETS_KEY_PREFIX = 'secrets/'

export const accountItemKey = (address: string): BackupItemKey =>
    `${BACKUP_ACCOUNTS_KEY_PREFIX}${address}`

export const secretsItemKey = (address: string): BackupItemKey =>
    `${BACKUP_SECRETS_KEY_PREFIX}${address}`

/** An address record and its key material are both BackupItemType.ACCOUNT on
 *  the wire, so only the key prefix tells them apart. */
export const isAccountItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)
