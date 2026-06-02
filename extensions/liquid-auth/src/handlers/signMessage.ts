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

import { ARC0027_ERROR_CODES } from '../arc0027/types'
import { Arc0027Error } from '../arc0027/errors'
import type { Arc0027Handler } from '../arc0027/dispatcher'

/**
 * Surfaces an ARC-60 sign-data request to the signing pipeline. The handler
 * forwards the raw ARC-0027 params verbatim (the full ARC-60 `StdSigData` +
 * `Metadata` wire shape) — validation/construction happens app-side via the
 * shared `arc60PayloadSchema`, mirroring the WalletConnect ARC-60 handler.
 * `approve` receives the base64 signature array (ARC-60 yields one);
 * `reject`/`error` map to the matching ARC-0027 error codes.
 */
export type EnqueueArc60 = (request: {
    params: unknown
    transportId: string
    approve: (signatures: string[]) => void
    reject: () => void
    error: (error: Error) => void
}) => void

export const createSignMessageHandler =
    (deps: {
        enqueueArc60: EnqueueArc60
        transportId: string
    }): Arc0027Handler =>
    envelope =>
        new Promise((resolve, reject) => {
            deps.enqueueArc60({
                params: envelope.params,
                transportId: deps.transportId,
                approve: signatures => resolve({ signature: signatures[0] }),
                reject: () =>
                    reject(
                        new Arc0027Error(
                            ARC0027_ERROR_CODES.MethodCanceledError,
                            'User rejected the sign request',
                        ),
                    ),
                error: error =>
                    reject(
                        new Arc0027Error(
                            ARC0027_ERROR_CODES.UnknownError,
                            error.message,
                        ),
                    ),
            })
        })
