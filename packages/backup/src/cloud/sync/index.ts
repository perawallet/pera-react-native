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

export { canonicalJson, contentHash } from './canonicalize'
export { serializeAccountItems } from './serializeAccountItems'
export { buildLocalItems } from './buildLocalItems'
export { reconcile } from './reconcile'
export { applyDeltas } from './applyDeltas'
export { pushDirty } from './pushDirty'
export { syncBackup } from './syncBackup'
export { pullBackupDeltas } from './pullBackupDeltas'
export { serializeAccountForBackup } from './serializeAccountForBackup'
export { BackupWebSocketClient } from './webSocketClient'
export type {
    BackupSocketFactory,
    BackupWebSocketEvent,
    WebSocketLike,
} from './webSocketClient'
export {
    BackupSyncManager,
    initializeBackupSyncManager,
    getBackupSyncManager,
} from './backupSyncManager'
export type { BackupSyncManagerDeps } from './backupSyncManager'
export { UnsupportedBackupAccountTypeError } from './types'
export type {
    SerializedItem,
    SerializedAccount,
    LocalItem,
    SyncEngineDeps,
    SyncImportFn,
    ImportSummary,
    SerializeHdResolver,
    SerializeMnemonicResolver,
} from './types'
