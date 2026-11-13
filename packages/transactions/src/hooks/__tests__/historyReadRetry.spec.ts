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

import { afterEach, describe, expect, it } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { shouldRetryHistoryRead } from '../historyReadRetry'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('shouldRetryHistoryRead', () => {
    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('retries the first failure and then gives up', () => {
        const error = new Error('not ready')

        expect(shouldRetryHistoryRead(0, error)).toBe(true)
        expect(shouldRetryHistoryRead(1, error)).toBe(false)
    })

    it('never retries a Pera service the network lacks', () => {
        expect(
            shouldRetryHistoryRead(0, new PeraServiceUnavailableError(SCOPE)),
        ).toBe(false)
    })

    it('does not retry while offline', () => {
        onlineManager.setOnline(false)

        expect(shouldRetryHistoryRead(0, new Error('offline'))).toBe(false)
    })
})
