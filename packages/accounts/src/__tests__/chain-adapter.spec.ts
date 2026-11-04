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
import { CHART_QUERY_TIMEOUT_MS } from '@perawallet/wallet-core-shared'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    deriveHdAccount,
    describeHolding,
    fetchHoldingAcquisitionOrder,
    fetchHoldingBalanceHistory,
    fetchPortfolioHistory,
    hdDeriveOpts,
} from '../chain-adapter'
import { HdAccountsUnsupportedError } from '../errors'
import {
    FAKE_LOCAL_KEY_KINDS,
    MAINNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

describe('hdDeriveOpts', () => {
    it("takes the scheme from the chain's HD key kind and the network from the scope", () => {
        expect(hdDeriveOpts(MAINNET_SCOPE)).toEqual({
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
    })

    it('refuses a chain that declares no HD key kind', () => {
        registerFakeAccountsChain({
            localKeyKinds: FAKE_LOCAL_KEY_KINDS.filter(kind => !kind.isHd),
        })

        expect(() => hdDeriveOpts(MAINNET_SCOPE)).toThrow(
            HdAccountsUnsupportedError,
        )
    })
})

describe('deriveHdAccount', () => {
    it('derives through the registered key derivation with the shared KMS core', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        const derived = await deriveHdAccount(MAINNET_SCOPE, 'seed-1', {
            account: 2,
            keyIndex: 5,
        })

        expect(deriveAccount).toHaveBeenCalledWith(kmsCore, 'seed-1', 2, 5, {
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
        expect(derived.keyPairId).toBe('seed-1-acc2-idx5-dt9')
    })
})

describe('operations a chain may leave out', () => {
    const bare = () =>
        registerFakeAccountsChain({
            fetchHoldingAcquisitionOrder: undefined,
            fetchPortfolioHistory: undefined,
            fetchHoldingBalanceHistory: undefined,
            describeHolding: undefined,
        })

    it('answers an empty acquisition order without asking the chain', async () => {
        bare()

        await expect(
            fetchHoldingAcquisitionOrder('ADDR', MAINNET_SCOPE),
        ).resolves.toEqual(new Map())
    })

    it('answers no portfolio history source and an empty holding history', async () => {
        bare()

        await expect(
            fetchPortfolioHistory(['ADDR'], 'one-day', MAINNET_SCOPE),
        ).resolves.toBeNull()
        await expect(
            fetchHoldingBalanceHistory('ADDR', '1', 'one-day', MAINNET_SCOPE),
        ).resolves.toEqual([])
    })

    it('places no restriction on a holding', () => {
        bare()

        expect(
            describeHolding('algorand', { family: 'algorand', isFrozen: true }),
        ).toEqual({ restriction: null })
    })

    it('places no restriction on a holding with no native data, without asking the chain', () => {
        const { adapter } = fakeAccountsChain()

        expect(describeHolding('algorand', null)).toEqual({ restriction: null })
        expect(adapter.describeHolding).not.toHaveBeenCalled()
    })

    it('defers to the chain when it declares the operation', async () => {
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.fetchHoldingAcquisitionOrder!).mockResolvedValue(
            new Map([['1', 5]]),
        )

        await expect(
            fetchHoldingAcquisitionOrder('ADDR', MAINNET_SCOPE),
        ).resolves.toEqual(new Map([['1', 5]]))
        expect(
            describeHolding('algorand', { family: 'algorand', isFrozen: true }),
        ).toEqual({ restriction: 'transferBlocked' })
    })
})

describe('history deadlines', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    const settle = async (promise: Promise<unknown>) => {
        const outcome = promise.catch((error: Error) => error)
        await vi.advanceTimersByTimeAsync(CHART_QUERY_TIMEOUT_MS - 1)
        return outcome
    }

    it.each([
        [
            'portfolio history',
            () => fetchPortfolioHistory(['ADDR'], 'one-day', MAINNET_SCOPE),
            { fetchPortfolioHistory: () => new Promise<never>(() => {}) },
        ],
        [
            'holding balance history',
            () =>
                fetchHoldingBalanceHistory(
                    'ADDR',
                    '1',
                    'one-day',
                    MAINNET_SCOPE,
                ),
            { fetchHoldingBalanceHistory: () => new Promise<never>(() => {}) },
        ],
    ])(
        'rejects %s with a TimeoutError once the chain has not answered in time, and not before',
        async (operation, call, override) => {
            vi.useFakeTimers()
            registerFakeAccountsChain(override)
            const rejection = call().catch((error: Error) => error)
            let isSettled = false
            void rejection.then(() => {
                isSettled = true
            })

            await vi.advanceTimersByTimeAsync(CHART_QUERY_TIMEOUT_MS - 1)
            expect(isSettled).toBe(false)
            await vi.advanceTimersByTimeAsync(1)

            const error = await rejection
            expect(error).toMatchObject({ name: 'TimeoutError' })
            expect((error as Error).message).toContain(operation)
        },
    )

    it('aborts the signal the chain was handed when the deadline fires, so its requests stop', async () => {
        vi.useFakeTimers()
        let handed: AbortSignal | undefined
        registerFakeAccountsChain({
            fetchPortfolioHistory: (_a, _p, _s, signal) => {
                handed = signal
                return new Promise<never>(() => {})
            },
        })
        const rejection = fetchPortfolioHistory(
            ['ADDR'],
            'one-day',
            MAINNET_SCOPE,
        ).catch((error: Error) => error)

        await vi.advanceTimersByTimeAsync(CHART_QUERY_TIMEOUT_MS - 1)
        expect(handed?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)

        expect(handed?.aborted).toBe(true)
        expect(await rejection).toMatchObject({ name: 'TimeoutError' })
    })

    it("aborts the chain's signal when the caller cancels, and rejects with the chain's own error", async () => {
        const cancelled = new Error('cancelled')
        cancelled.name = 'AbortError'
        registerFakeAccountsChain({
            fetchHoldingBalanceHistory: (_a, _i, _p, _s, signal) =>
                new Promise<never>((_, reject) =>
                    signal?.addEventListener('abort', () => reject(cancelled)),
                ),
        })
        const caller = new AbortController()
        const rejection = fetchHoldingBalanceHistory(
            'ADDR',
            '1',
            'one-day',
            MAINNET_SCOPE,
            caller.signal,
        ).catch((error: Error) => error)

        caller.abort()

        expect(await rejection).toBe(cancelled)
    })

    it('passes a history that answers in time through untouched', async () => {
        vi.useFakeTimers()
        registerFakeAccountsChain({
            fetchPortfolioHistory: vi.fn(async () => []),
        })

        const outcome = await settle(
            fetchPortfolioHistory(['ADDR'], 'one-day', MAINNET_SCOPE),
        )

        expect(outcome).toEqual([])
    })

    it('forwards the address, asset, period and scope to the holding history', async () => {
        const { adapter } = registerFakeAccountsChain()

        await fetchHoldingBalanceHistory('ADDR', '7', 'one-week', MAINNET_SCOPE)

        expect(adapter.fetchHoldingBalanceHistory).toHaveBeenCalledWith(
            'ADDR',
            '7',
            'one-week',
            MAINNET_SCOPE,
            expect.any(AbortSignal),
        )
    })
})
