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

/** Posts base64 msgpack signed txns to algod and returns the txn ids. */
type SubmitFn = (stxns: string[]) => Promise<string[]>

/** Runs the sign_transactions handler and returns its { stxns } result. */
type SignFn = (
    envelope: Parameters<Arc0027Handler>[0],
) => Promise<{ stxns: Nullable<string>[] }>

export const createPostTransactionsHandler =
    (deps: { submit: SubmitFn }): Arc0027Handler =>
    async envelope => {
        const params = envelope.params as { stxns?: string[] } | undefined
        const stxns = params?.stxns ?? []
        try {
            const txnIds = await deps.submit(stxns)
            return { txnIds }
        } catch (error) {
            throw new Arc0027Error(
                ARC0027_ERROR_CODES.FailedToPostSomeTransactionsError,
                error instanceof Error ? error.message : 'Failed to post',
            )
        }
    }

export const createSignAndPostTransactionsHandler =
    (deps: { sign: SignFn; submit: SubmitFn }): Arc0027Handler =>
    async envelope => {
        const { stxns } = await deps.sign(envelope)
        const signedOnly = stxns.filter((s): s is string => s !== null)
        try {
            const txnIds = await deps.submit(signedOnly)
            return { txnIds }
        } catch (error) {
            throw new Arc0027Error(
                ARC0027_ERROR_CODES.FailedToPostSomeTransactionsError,
                error instanceof Error ? error.message : 'Failed to post',
            )
        }
    }
