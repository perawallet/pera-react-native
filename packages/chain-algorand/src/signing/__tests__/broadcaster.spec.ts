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

import { describe, expect, test, vi } from 'vitest'
import { AlgodError } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: {
        getState: () => ({ network: 'testnet' }),
        subscribe: () => () => {},
    },
}))

import { algorandBroadcasterAdapter } from '../broadcaster'

describe('algorandBroadcasterAdapter.submitTimeoutError', () => {
    test('is a retryable network_unavailable error naming the timeout', () => {
        const error = algorandBroadcasterAdapter.submitTimeoutError(5000)

        expect(error).toBeInstanceOf(AlgodError)
        expect((error as AlgodError).code).toBe('network_unavailable')
        expect(error.metadata.retryable).toBe(true)
        expect(error.originalError?.message).toContain('5000ms')
    })
})
