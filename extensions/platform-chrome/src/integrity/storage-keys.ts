/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/** chrome.storage.session — the minted app-integrity JWT (memory-only). */
export const INTEGRITY_TOKEN_SESSION_KEY = 'integrity:token'
/** chrome.storage.session — consecutive mint failures and the next allowed attempt. */
export const INTEGRITY_BACKOFF_SESSION_KEY = 'integrity:backoff'
