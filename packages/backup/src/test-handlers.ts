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

// Test-only barrel — exposes co-located MSW handler factories, plus the item
// decryptor tests need to read back what the fake backend stored, without
// pulling either into the production bundle entry. Import via
// `@perawallet/wallet-core-backup/test-handlers` in test files.

export {
    buildRegisterHandler,
    type BuildRegisterHandlerParams,
    buildRestoreHandlers,
    type RestoreFixtureItem,
    type BuildRestoreHandlersParams,
    buildSyncHandlers,
    type BuildSyncHandlersParams,
    type SyncHandlerHandle,
} from './cloud/api/msw-handlers'

export { decryptItemPayload } from './cloud/crypto/itemPayload'
