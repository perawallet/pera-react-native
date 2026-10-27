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

// The handler factories the packages' own tests use, re-exported from source:
// they are test entries, not part of any package's public exports, and the
// monorepo is on Metro's watch path.
export { mockShouldRefresh } from '../../../../packages/chain-algorand/src/test-handlers'
export {
    evmRpcHandlers,
    peraEvmHandlers,
} from '../../../../packages/chain-ethereum/src/test-handlers'
export { buildSyncHandlers } from '../../../../packages/backup/src/test-handlers'
