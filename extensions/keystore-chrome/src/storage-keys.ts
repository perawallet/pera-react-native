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

// Single source of truth for every chrome.storage key the keystore owns.
// Extracted per the M2 Task 14 review: passkey/vault key literals were
// duplicated inline (vault.ts createVault) to dodge a circular import.

/** chrome.storage.local — password-wrapped master key blob. */
export const VAULT_STORAGE_KEY = 'vault:wrapped-master-key'
/** chrome.storage.local — PRF-wrapped master key blob (passkey unlock). */
export const PRF_BLOB_KEY = 'vault:wrapped-master-key-prf'
/** chrome.storage.local — WebAuthn credential id for passkey unlock. */
export const PRF_CRED_ID_KEY = 'vault:prf-credential-id'
/** chrome.storage.session — raw unlocked master key (memory-only). */
export const SESSION_MASTER_KEY = 'vault:master-key'
/** chrome.storage.local prefix — encrypted key entries (MMKV namespace parity). */
export const KEYSTORE_PREFIX = 'keystore:'
/** chrome.storage.local — persisted auto-lock preference (minutes). */
export const AUTO_LOCK_MINUTES_KEY = 'vault:auto-lock-minutes'
