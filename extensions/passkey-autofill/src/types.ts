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

import type { PasskeyAutofillCredentialIdentity } from '@algorandfoundation/react-native-passkey-autofill'
import type { PasskeyAutofillService } from './service'

export type NativeStoredCredential = PasskeyAutofillCredentialIdentity

/**
 * Callback signature for native passkey lifecycle events emitted from the
 * system credential provider extension.
 */
export type PasskeyAutofillEventCallback = (event: { success: boolean }) => void

export interface PasskeyAutofillSubscription {
    remove: () => void
}

/**
 * The interface exposed on the provider once `WithPasskeyAutofill` is composed.
 */
export interface PasskeyAutofillExtension {
    passkeyAutofill: PasskeyAutofillService
}

/**
 * A password row published to the OS credential index so the system offers Pera
 * for a given service. Domain and user necessarily leave the sealed keystore
 * record here — the OS cannot offer a credential it knows nothing about.
 */
export interface PasswordCredentialIdentity {
    /** The keystore id of the login this row resolves to. */
    recordIdentifier: string
    /** Domain the credential applies to, e.g. `example.com`. */
    serviceIdentifier: string
    /** The username shown in the system picker. */
    user: string
}
