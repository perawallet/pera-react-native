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

import type { BackupId } from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    ChooseCloudFile,
    CloudFileReadResult,
    CloudFileSaveResult,
    CloudFileStore,
} from '@perawallet/wallet-extension-platform'

/** A local file alongside the cloud drives the platform can reach. */
export type CredentialsFileSource = 'device' | CloudFileStore

export type SaveResult = CloudFileSaveResult
export type ReadResult = CloudFileReadResult
export type ChooseCredentialsFile = ChooseCloudFile

export type BackupCredentials = {
    salt: string
    backupId: BackupId
}

/** Straight off a store, where either half can be gone: the backup was deleted
 *  or the draft cleared while a sheet, a PIN or a sign-in was open. */
export type MaybeBackupCredentials = {
    [K in keyof BackupCredentials]: Nullable<BackupCredentials[K]>
}
