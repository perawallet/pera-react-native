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

// Keystore lookup ids. Both entries are stored as canonical `secret-key`
// keystore records via `commitSecret`; the id disambiguates which slot
// (hashed PIN record vs. biometric blob — the PinRecord bytes mirrored so
// biometric auth can confirm a PIN exists without re-prompting).
export const PIN_RECORD_KEY_ID = 'pera.pinCode'
export const BIOMETRIC_BLOB_KEY_ID = 'pera.biometricPinCode'
export const DURESS_PIN_RECORD_KEY_ID = 'pera.duressPinCode'
