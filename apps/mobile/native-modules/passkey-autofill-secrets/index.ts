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

import { requireOptionalNativeModule } from 'expo'

export type PeraPasskeyAutofillSecretsModule = {
    /**
     * Persists the keystore master key into the shared passkey-autofill store
     * (the same App Group `UserDefaults` entry the iOS credential-provider
     * extension reads) as **raw bytes**.
     *
     * The point is what it avoids: handing the secret to the cross-bridge API
     * as a hex `string` — JS strings are immutable and GC-owned, so they can't
     * be wiped and linger in the JS heap. Passing the bytes straight to native
     * means no non-zeroable hex string is ever materialized in JavaScript; the
     * source `Uint8Array` is zeroed by the caller and this module zeroes its
     * native copy after writing.
     *
     * Implemented on both iOS and Android, each writing the platform store the
     * credential provider reads. Resolves `true` only on a verified write (on
     * Android the value is read back and compared before reporting success);
     * resolves `false` — or is absent on older builds where
     * `requireOptionalNativeModule` returns `null` — so callers fall back to
     * the string bridge.
     */
    setMasterKey(masterKey: Uint8Array): Promise<boolean>
}

export const PeraPasskeyAutofillSecrets =
    requireOptionalNativeModule<PeraPasskeyAutofillSecretsModule>(
        'PeraPasskeyAutofillSecrets',
    )
