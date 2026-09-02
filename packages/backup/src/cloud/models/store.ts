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

import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { BackupId } from './types'

export type CloudBackupState = BaseStoreState & {
    /** DID-compatible backup identifier; null until configured. */
    backupId: BackupId | null
    /** Base64-encoded salt used for key derivation; null until configured. */
    salt: string | null
    /** Device id this backup was registered with. Held here rather than read
     *  from the device store at call time, so every signed request uses the id
     *  the server knows. Null for backups configured before it was stored. */
    deviceId: string | null
}

export type CloudBackupActions = {
    /** Marks the backup configured and stores its identity. */
    setConfigured: (params: {
        backupId: BackupId
        salt: string
        deviceId: string
    }) => void
    isConfigured: () => boolean
}

export type CloudBackupStore = CloudBackupState & CloudBackupActions
