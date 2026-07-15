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

/**
 * Thrown when a passkey hook is invoked but the provider was constructed
 * without the passkey autofill extension. This typically indicates a
 * misconfigured `PeraProvider` composition.
 */
export class PasskeyAutofillUnavailableError extends Error {
    constructor() {
        super(
            'PasskeyAutofillService is not registered on the provider. Compose WithPasskeyAutofill into PeraProvider.',
        )
        this.name = 'PasskeyAutofillUnavailableError'
    }
}

/**
 * Thrown when removing a passkey fails because the keystore reports the key
 * as missing. Surfaced from the remove-mutation so the UI can show a
 * "passkey was already deleted" state rather than an opaque error.
 */
export class PasskeyKeyNotFoundError extends Error {
    constructor(public readonly keyId: string) {
        super(`No keystore key found for credential id ${keyId}`)
        this.name = 'PasskeyKeyNotFoundError'
    }
}
