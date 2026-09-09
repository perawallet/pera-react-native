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

// Keystore lookup ids, stored as canonical `secret-key` records via
// `commitSecret`. The biometric blob holds a random unlock token sealed by an
// OS-bound key; the token's hash rides as record metadata, which lives in the
// plaintext bucket and so is readable without a decrypt.
export const PIN_RECORD_KEY_ID = 'pera.pinCode'
export const BIOMETRIC_BLOB_KEY_ID = 'pera.biometricUnlockToken'
// Held a copy of the PIN record with no OS-bound key behind it. Referenced only
// by the reconcile, which sweeps it and asks the user to opt in again.
export const LEGACY_BIOMETRIC_BLOB_KEY_ID = 'pera.biometricPinCode'
export const BIOMETRIC_TOKEN_HASH_METADATA_KEY = 'biometricTokenHash'
// Leading byte of the stored blob, so an unwrap refuses a framing it does not
// understand instead of handing it to the enclave as a decryption error.
export const BIOMETRIC_BLOB_VERSION = 2
// Consecutive ceremonies that passed but whose key could not release the
// token before the opt-in is dropped. Above one because keystore operations
// get pruned under load; small because every failure is a wasted prompt.
export const MAX_BIOMETRIC_UNWRAP_FAILURES = 3
// v2 kept the duress PIN under this separate id. Key ids live in a plaintext
// metadata bucket, so the record's mere existence told a device image the
// duress feature was in use; v3 folds the duress slot into `pera.pinCode`.
// Referenced only by the migration, which deletes any record found under it.
export const LEGACY_DURESS_PIN_RECORD_KEY_ID = 'pera.duressPinCode'
