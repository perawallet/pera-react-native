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

import ReactNativePasskeyAutofill from '@algorandfoundation/react-native-passkey-autofill'
import type { Extension } from '@algorandfoundation/wallet-provider'
import type { KeyStoreExtension } from '@algorandfoundation/keystore-core'
import {
    PasskeyAutofillService,
    type PasskeyAutofillNativeAPI,
} from './service'
import type { PasskeyAutofillExtension } from './types'

/**
 * wallet-provider Extension that registers the passkey autofill service on
 * the provider. Must be composed AFTER `WithKeyStore`.
 */
export const WithPasskeyAutofill: Extension<PasskeyAutofillExtension> = (
    provider: KeyStoreExtension & Record<string, unknown>,
) => {
    const native =
        ReactNativePasskeyAutofill as unknown as PasskeyAutofillNativeAPI
    const service = new PasskeyAutofillService(native)
    provider.passkeyAutofill = service
    return { passkeyAutofill: service }
}
