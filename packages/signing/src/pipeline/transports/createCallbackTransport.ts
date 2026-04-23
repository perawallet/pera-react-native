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

import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../types'
import { TransportError } from '../errors'

/**
 * Creates a transport that delivers signed data back to the caller via the
 * `source.callbacks.approve` function.
 *
 * Used by internal flows (e.g. swap) that need the signing pipeline as a
 * signing service only — the caller takes care of submission, retries, and
 * any UI. Unlike {@link createWalletConnectTransport} this does not require
 * a `requestId`, since local callers have no transport id to echo back.
 */
export const createCallbackTransport = (): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            _multisigAddress?: string,
        ): Promise<TransportResult> => {
            if (!source.callbacks?.approve) {
                throw new TransportError(
                    'No approve callback provided for callback transport',
                )
            }

            try {
                await source.callbacks.approve(result)

                return {
                    type: 'callback-sent',
                    requestId: source.requestId ?? '',
                }
            } catch (error) {
                const err =
                    error instanceof Error ? error : new Error(String(error))

                if (source.callbacks?.error) {
                    await source.callbacks.error(err)
                }

                throw new TransportError(err.message, err)
            }
        },
    }
}
