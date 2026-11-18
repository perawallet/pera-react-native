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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import {
    PeraNetworkError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import {
    historyReadRetryDelay,
    shouldRetryHistoryRead,
} from '../historyReadRetry'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const RATE_LIMITED = new PeraNetworkError('client', { status: 429 })

describe('shouldRetryHistoryRead', () => {
    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('retries the first failure and then gives up', () => {
        const error = new Error('not ready')

        expect(shouldRetryHistoryRead(0, error)).toBe(true)
        expect(shouldRetryHistoryRead(1, error)).toBe(false)
    })

    it('retries a rate-limited read three times', () => {
        expect(shouldRetryHistoryRead(2, RATE_LIMITED)).toBe(true)
        expect(shouldRetryHistoryRead(3, RATE_LIMITED)).toBe(false)
    })

    it("retries the backend's 503 for an upstream rate limit like a 429", () => {
        const upstream = new PeraNetworkError('server', {
            status: 503,
            backendCode: 'upstream_unavailable',
        })
        expect(shouldRetryHistoryRead(2, upstream)).toBe(true)
        expect(
            shouldRetryHistoryRead(
                1,
                new PeraNetworkError('server', { status: 503 }),
            ),
        ).toBe(false)
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

describe('historyReadRetryDelay', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("keeps TanStack's delay for a read that wasn't rate limited", () => {
        expect(historyReadRetryDelay(0, new Error('not ready'))).toBe(1000)
    })

    it('backs a rate-limited read off from 2s, doubling, with up to half again of jitter', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0)
        expect(
            [0, 1, 2].map(count => historyReadRetryDelay(count, RATE_LIMITED)),
        ).toEqual([2000, 4000, 8000])

        vi.spyOn(Math, 'random').mockReturnValue(0.999)
        expect(historyReadRetryDelay(0, RATE_LIMITED)).toBeLessThan(3000)
    })
})
