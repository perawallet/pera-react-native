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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import * as signing from '../index'
import {
    broadcasterChainAdapters,
    createSubmitTransport,
    deriveSubmissionAttemptFromBytes,
    isRequestGroupAlreadySubmitted,
    reconcileOpenSubmissions,
    setOnConfirmedHandler,
    setSubmissionSettledHandler,
    submitAndAutoRefresh,
} from '../broadcaster'
import type { SignRequest } from '../models'
import { registerFakeBroadcaster } from './fakeBroadcaster'

const algokit = { client: { algod: { sendRawTransaction: vi.fn() } } }
const encode = vi.fn()
const request = { id: 'req-1' } as unknown as SignRequest

describe('broadcaster wrappers', () => {
    it('forward their arguments to the registered adapter and return its result', async () => {
        const transport = { send: vi.fn() }
        const summary = { probed: 2, confirmed: 1, failed: 1 }
        const derived = { txIds: ['TX1'], lastValid: 7 }
        const handler = vi.fn()
        const adapter = registerFakeBroadcaster({
            createSubmitTransport: vi.fn(() => transport),
            submitAndAutoRefresh: vi.fn(async () => ['TX1']),
            isRequestGroupAlreadySubmitted: vi.fn(async () => true),
            reconcileOpenSubmissions: vi.fn(async () => summary),
            deriveSubmissionAttemptFromBytes: vi.fn(() => derived),
        })
        const bytes = [new Uint8Array([1])]

        expect(createSubmitTransport(algokit, encode, 'testnet')).toBe(
            transport,
        )
        expect(adapter.createSubmitTransport).toHaveBeenCalledWith(
            algokit,
            encode,
            'testnet',
        )

        await expect(
            submitAndAutoRefresh(algokit, encode, [], { flow: 'swap' }),
        ).resolves.toEqual(['TX1'])
        expect(adapter.submitAndAutoRefresh).toHaveBeenCalledWith(
            algokit,
            encode,
            [],
            { flow: 'swap' },
        )

        await expect(isRequestGroupAlreadySubmitted(request)).resolves.toBe(
            true,
        )
        expect(adapter.isRequestGroupAlreadySubmitted).toHaveBeenCalledWith(
            request,
        )

        await expect(reconcileOpenSubmissions()).resolves.toBe(summary)
        expect(deriveSubmissionAttemptFromBytes(bytes)).toBe(derived)
        expect(adapter.deriveSubmissionAttemptFromBytes).toHaveBeenCalledWith(
            bytes,
        )

        setOnConfirmedHandler(handler)
        expect(adapter.setOnConfirmedHandler).toHaveBeenCalledWith(handler)
        setSubmissionSettledHandler('cosign', handler)
        expect(adapter.setSubmissionSettledHandler).toHaveBeenCalledWith(
            'cosign',
            handler,
        )
    })

    it('throw ChainAdapterNotRegisteredError when no adapter is registered', async () => {
        broadcasterChainAdapters.reset()

        expect(() => createSubmitTransport(algokit, encode, 'testnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        await expect(
            Promise.resolve().then(() =>
                submitAndAutoRefresh(algokit, encode, []),
            ),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            Promise.resolve().then(() =>
                isRequestGroupAlreadySubmitted(request),
            ),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            Promise.resolve().then(() => reconcileOpenSubmissions()),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        expect(() => deriveSubmissionAttemptFromBytes([])).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => setOnConfirmedHandler(null)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => setSubmissionSettledHandler('swap', null)).toThrow(
            ChainAdapterNotRegisteredError,
        )
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
