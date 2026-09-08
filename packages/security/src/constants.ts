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

export const PIN_LENGTH = 6
export const MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT = 5
export const INITIAL_LOCKOUT_SECONDS = 30
export const AUTO_LOCK_TIMEOUT_MS = 2 * 60 * 1000

// Keystore lookup ids. Both live ids are stored as canonical `secret-key`
// keystore records via `commitSecret`. The biometric blob holds a random unlock
// token sealed by an OS-bound key; the token's hash rides as record metadata,
// which lives in the plaintext bucket and so is readable without a decrypt.
export const PIN_RECORD_KEY_ID = 'pera.pinCode'
export const BIOMETRIC_BLOB_KEY_ID = 'pera.biometricPinCode'
export const BIOMETRIC_TOKEN_HASH_METADATA_KEY = 'biometricTokenHash'
// Leading byte of the stored blob. Pre-binding blobs held serialized JSON, so
// they always begin 0x7B and can never be mistaken for this. The reconcile
// discriminates on the key-pair probe, not on this byte — it is here so an
// unwrap refuses a blob it does not understand instead of failing as a
// decryption error.
export const BIOMETRIC_BLOB_VERSION = 2
// v2 kept the duress PIN under this separate id. Key ids live in a plaintext
// metadata bucket, so the record's mere existence told a device image the
// duress feature was in use; v3 folds the duress slot into `pera.pinCode`.
// Referenced only by the migration, which deletes any record found under it.
export const LEGACY_DURESS_PIN_RECORD_KEY_ID = 'pera.duressPinCode'
