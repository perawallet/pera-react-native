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

// Web shim for @algorandfoundation/react-native-passkey-autofill.
// The real package calls requireNativeModule('ReactNativePasskeyAutofill') at
// module-eval time — that throws in browser environments (no native bridge).
// Passkey autofill (iOS/Android credential provider) is a native-only capability;
// on web the PasskeyAutofillService simply has nothing to delegate to.

const noop = () => Promise.resolve()
const noopNull = () => Promise.resolve(null)
const noopArray = () => Promise.resolve([])

// Mirror the PasskeyAutofillNativeAPI interface as a no-op object (default export).
const PasskeyAutofillModule = {
    setMasterKey: noop,
    setHdRootKeyId: noop,
    getHdRootKeyId: noopNull,
    // setDerivedMainKey intentionally absent: PasskeyAutofillService derives
    // `supportsDerivedMainKey` from `typeof native.setDerivedMainKey ===
    // 'function'`, and bootstrapPasskeyAutofill only stringifies the derived
    // main key to hex when that reports true. Defining it here — even as a
    // no-op — would flip the flag on web and make the bootstrap materialize a
    // non-zeroable hex copy of the key for a bridge that does nothing with it.
    // The absent-method path is the one that keeps the secret out of memory.
    configureIntentActions: noop,
    clearCredentials: noop,
    deleteCredential: noop,
    replaceCredentialIdentities: noop,
    refreshCredentialIdentities: noop,
    getStoredCredentials: noopArray,
    getDiagnostics: noopArray,
    // addListener / removeListeners intentionally absent: PasskeyAutofillService.subscribe()
    // checks typeof this.native.addListener !== 'function' and returns { remove: () => void }
    // when absent — the consuming service's own safe fallback is cleaner than returning
    // undefined here (which the service trusted as a real subscription object).
}

export default PasskeyAutofillModule
