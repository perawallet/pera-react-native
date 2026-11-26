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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'

type BackupWarningCopy = { plain: I18nKey; withCloudBackup: I18nKey }

// What the account's key can be recovered from, and whether an Auth Account
// can manage it. Only the kinds that can be rekeyed mention an Auth Account.
const BACKUP_WARNING_COPY = {
    privateKey: {
        plain: i18nKey('account_options.backup_warning_private_key_message'),
        withCloudBackup: i18nKey(
            'account_options.backup_warning_private_key_message_with_cloud_backup',
        ),
    },
    passphrase: {
        plain: i18nKey('account_options.backup_warning_passphrase_message'),
        withCloudBackup: i18nKey(
            'account_options.backup_warning_passphrase_message_with_cloud_backup',
        ),
    },
    passphraseOrAuthAccount: {
        plain: i18nKey('account_options.backup_warning_message'),
        withCloudBackup: i18nKey(
            'account_options.backup_warning_message_with_cloud_backup',
        ),
    },
} as const satisfies Record<string, BackupWarningCopy>

export const backupWarningCopyFor = ({
    isPrivateKey,
    canHaveAuthAccount,
}: {
    isPrivateKey: boolean
    canHaveAuthAccount: boolean
}): BackupWarningCopy => {
    if (isPrivateKey) return BACKUP_WARNING_COPY.privateKey
    return canHaveAuthAccount
        ? BACKUP_WARNING_COPY.passphraseOrAuthAccount
        : BACKUP_WARNING_COPY.passphrase
}
