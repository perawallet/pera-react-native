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

import { vi } from 'vitest'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { AppError, concatBytes } from '@perawallet/wallet-core-shared'
import {
    broadcasterChainAdapters,
    type BroadcasterChainAdapter,
} from '../broadcaster'
import type { DataTransport } from '../pipeline/types'

// Really calls the given algod client and rethrows its error, for specs that
// assert on the submit call and its failure.
export const algodBackedTransport = (
    algokit: {
        client: {
            algod: {
                sendRawTransaction(raw: Uint8Array): { do(): Promise<unknown> }
            }
        }
    },
    encodeSignedTransactions: (signed: never) => Uint8Array[],
): DataTransport => ({
    send: async result => {
        if (result.signedData.type !== 'transactions') {
            throw new Error('fake broadcaster: transactions only')
        }
        const raw = concatBytes(
            ...encodeSignedTransactions(result.signedData.signed as never),
        )
        const response = (await algokit.client.algod
            .sendRawTransaction(raw)
            .do()) as { txid?: string | string[] }
        return {
            type: 'submitted',
            txIds: [response?.txid ?? []].flat(),
        }
    },
})

export const fakeBroadcasterAdapter = (
    overrides: Partial<BroadcasterChainAdapter> = {},
): BroadcasterChainAdapter => ({
    chainId: LEGACY_CHAIN_ID,
    createSubmitTransport: vi.fn(() => ({
        send: async () => ({ type: 'submitted', txIds: [] }),
    })),
    submitAndAutoRefresh: vi.fn(async () => []),
    isRequestGroupAlreadySubmitted: vi.fn(async () => false),
    reconcileOpenSubmissions: vi.fn(async () => ({
        probed: 0,
        confirmed: 0,
        failed: 0,
    })),
    deriveSubmissionAttemptFromBytes: vi.fn(() => ({ txIds: [] })),
    setOnConfirmedHandler: vi.fn(),
    setSubmissionSettledHandler: vi.fn(),
    submitTimeoutError: vi.fn(
        () => new AppError('fake submit timeout', { retryable: true }),
    ),
    ...overrides,
})

export const registerFakeBroadcaster = (
    overrides: Partial<BroadcasterChainAdapter> = {},
): BroadcasterChainAdapter => {
    const adapter = fakeBroadcasterAdapter(overrides)
    broadcasterChainAdapters.reset()
    broadcasterChainAdapters.register(adapter)
    return adapter
}
