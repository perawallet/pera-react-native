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

// The message primitives the MV3 runtime (@perawallet/wallet-core-browser-runtime)
// shares with this driver, on their own entry because the main barrel
// constructs every platform service at import.
//
// Duplicated from index.ts because this is a separate root, pulled into
// consumer tsc programs independently of it.
/// <reference types="chrome" />

export { isTrustedExtensionPageSender } from './trusted-sender'
export {
    DB_CONTROL_SCOPE,
    type EnsureOffscreenMessage,
} from './database/protocol'
