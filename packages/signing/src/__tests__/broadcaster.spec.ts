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

import { describe, expect, it, vi } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import * as signing from '../index'
import {
    broadcasterChainAdapters,
    deriveSubmissionAttemptFromBytes,
    reconcileOpenSubmissions,
    setOnConfirmedHandler,
    setSubmissionSettledHandler,
    submitAndAutoRefresh,
} from '../broadcaster'
import { registerFakeBroadcaster } from './fakeBroadcaster'

describe('broadcaster wrappers', () => {
    it('forward their arguments to the adapter registered for the chain and return its result', async () => {
        const summary = { probed: 2, confirmed: 1, failed: 1 }
        const derived = { txIds: ['TX1'], lastValid: 7 }
        const handler = vi.fn()
        const adapter = registerFakeBroadcaster({
            submitAndAutoRefresh: vi.fn(async () => ['TX1']),
            reconcileOpenSubmissions: vi.fn(async () => summary),
            deriveSubmissionAttemptFromBytes: vi.fn(() => derived),
        })
        const bytes = [new Uint8Array([1])]

        await expect(
            submitAndAutoRefresh(LEGACY_CHAIN_ID, [], { flow: 'swap' }),
        ).resolves.toEqual(['TX1'])
        expect(adapter.submitAndAutoRefresh).toHaveBeenCalledWith([], {
            flow: 'swap',
        })

        await expect(reconcileOpenSubmissions(LEGACY_CHAIN_ID)).resolves.toBe(
            summary,
        )
        expect(deriveSubmissionAttemptFromBytes(LEGACY_CHAIN_ID, bytes)).toBe(
            derived,
        )
        expect(adapter.deriveSubmissionAttemptFromBytes).toHaveBeenCalledWith(
            bytes,
        )

        setOnConfirmedHandler(LEGACY_CHAIN_ID, handler)
        expect(adapter.setOnConfirmedHandler).toHaveBeenCalledWith(handler)
        setSubmissionSettledHandler(LEGACY_CHAIN_ID, 'cosign', handler)
        expect(adapter.setSubmissionSettledHandler).toHaveBeenCalledWith(
            'cosign',
            handler,
        )
    })

    it('throw ChainAdapterNotRegisteredError when no adapter is registered', async () => {
        broadcasterChainAdapters.reset()

        await expect(
            Promise.resolve().then(() =>
                submitAndAutoRefresh(LEGACY_CHAIN_ID, []),
            ),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            Promise.resolve().then(() =>
                reconcileOpenSubmissions(LEGACY_CHAIN_ID),
            ),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        expect(() =>
            deriveSubmissionAttemptFromBytes(LEGACY_CHAIN_ID, []),
        ).toThrow(ChainAdapterNotRegisteredError)
        expect(() => setOnConfirmedHandler(LEGACY_CHAIN_ID, null)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() =>
            setSubmissionSettledHandler(LEGACY_CHAIN_ID, 'swap', null),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})

describe('signing root exports kept for other packages', () => {
    it.each([
        'submitAndAutoRefresh',
        'STALE_OPEN_ATTEMPT_MS',
        'deriveSubmissionAttemptFromBytes',
        'setSubmissionSettledHandler',
        'reconcileOpenSubmissions',
        'setOnConfirmedHandler',
        'broadcasterChainAdapters',
    ])('%s', name => {
        expect(signing).toHaveProperty(name)
        expect((signing as Record<string, unknown>)[name]).toBeDefined()
    })
})
