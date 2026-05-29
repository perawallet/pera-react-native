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
import type { Nullable } from '@perawallet/wallet-core-shared'

// Structural shapes — kept local to avoid leaking signing-package internals.
type ResolveFn = (
    request: { transactions: unknown },
    options: { authorizedAddresses?: Set<string> },
) => unknown

type EnqueueTransport = {
    sourceType: 'liquidauth'
    transportId: string
    sourceMetadata?: unknown
    respondWithResult: (result: Nullable<string>[]) => Promise<void> | void
    respondWithReject: () => void
    respondWithError: (error: Error) => void
}

type EnqueueFn = (resolved: unknown, transport: EnqueueTransport) => void

export type SignTransactionsConfig = {
    resolve: ResolveFn
    enqueue: EnqueueFn
    authorizedAddresses: Set<string>
    transportId: string
    sourceMetadata?: unknown
}

export const createSignTransactionsHandler =
    (config: SignTransactionsConfig): Arc0027Handler =>
    envelope =>
        new Promise((resolvePromise, rejectPromise) => {
            const params = envelope.params as { txns?: unknown } | undefined
            const resolved = config.resolve(
                { transactions: params?.txns ?? [] },
                { authorizedAddresses: config.authorizedAddresses },
            )
            config.enqueue(resolved, {
                sourceType: 'liquidauth',
                transportId: config.transportId,
                sourceMetadata: config.sourceMetadata,
                respondWithResult: result => {
                    resolvePromise({ stxns: result })
                },
                respondWithReject: () =>
                    rejectPromise(
                        new Arc0027Error(
                            ARC0027_ERROR_CODES.MethodCanceledError,
                            'User rejected the transaction request',
                        ),
                    ),
                respondWithError: error =>
                    rejectPromise(
                        new Arc0027Error(
                            ARC0027_ERROR_CODES.UnknownError,
                            error.message,
                        ),
                    ),
            })
        })
