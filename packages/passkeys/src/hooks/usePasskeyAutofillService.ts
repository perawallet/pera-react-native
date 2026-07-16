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

import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    PasskeyAutofillExtension,
    PasskeyAutofillService,
} from '@perawallet/wallet-extension-passkey-autofill'
import { PasskeyAutofillUnavailableError } from '../errors'

/**
 * Returns the `PasskeyAutofillService` registered on the provider. Throws if
 * `WithPasskeyAutofill` has not been composed into the provider.
 *
 * Not a React hook per se — does not subscribe to anything — but lives here so
 * UI callers can access the service consistently with other provider services.
 */
export const usePasskeyAutofillService = (): PasskeyAutofillService => {
    const provider =
        getProvider() as unknown as Partial<PasskeyAutofillExtension>
    if (!provider.passkeyAutofill) {
        throw new PasskeyAutofillUnavailableError()
    }
    return provider.passkeyAutofill
}
