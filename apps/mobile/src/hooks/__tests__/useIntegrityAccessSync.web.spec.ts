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

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    INTEGRITY_LAST_FAILURE_SESSION_KEY,
    INTEGRITY_TOKEN_SESSION_KEY,
    sendIntegrityControl,
} from '@perawallet/wallet-core-browser-runtime'
import {
    IntegrityRequiredError,
    setIntegrityTokenWaiter,
    setOnIntegrityRefused,
} from '@perawallet/wallet-core-shared'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import { queryClient } from '@providers/queryClient'
import { createSessionChromeFake } from '../../test-utils/chrome-session'
import { useNetworkStatusStore } from '../useNetworkStatusStore'
import { useIntegrityAccessStore } from '../useIntegrityAccessStore.web'
import { useIntegrityFeedbackStore } from '../useIntegrityFeedbackStore'
import { useIntegrityAccessSync } from '../useIntegrityAccessSync.web'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        webIntegrityMintEnabled: true,
        webIntegrityBearerEnabled: true,
        reactQueryDefaultGCTime: 1000,
        reactQueryDefaultStaleTime: 0,
    },
    registerCustomNetworkSource: vi.fn(() => () => undefined),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-browser-runtime')
    >()),
    sendIntegrityControl: vi.fn(),
}))

const liveToken = () => ({
    integrityToken: 'jwt',
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    mintedAt: new Date().toISOString(),
    deviceInstallationId: 'install-1',
})

const refusal = (hadToken: boolean) =>
    new IntegrityRequiredError({
        code: 'APP_INTEGRITY_TOKEN_REQUIRED',
        status: 403,
        hadToken,
    })

describe('useIntegrityAccessSync', () => {
    let fake: ReturnType<typeof createSessionChromeFake>

    beforeEach(() => {
        fake = createSessionChromeFake()
        globalThis.chrome = fake.chrome
        useIntegrityAccessStore.getState().resetState()
        useIntegrityFeedbackStore.getState().resetState()
        useAppIntegrityStore.getState().resetState()
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it("mirrors the worker's facts and follows their changes", async () => {
        await fake.chrome.storage.session.set({
            [INTEGRITY_TOKEN_SESSION_KEY]: liveToken(),
        })

        renderHook(() => useIntegrityAccessSync())
        await waitFor(() =>
            expect(
                useIntegrityAccessStore.getState().snapshot?.tokenExpiresAt,
            ).not.toBeNull(),
        )
        await act(() =>
            fake.chrome.storage.session.set({
                [INTEGRITY_LAST_FAILURE_SESSION_KEY]: {
                    phase: 'mint',
                    status: 503,
                    at: Date.now(),
                    isTransport: false,
                },
            }),
        )

        await waitFor(() =>
            expect(
                useIntegrityAccessStore.getState().snapshot?.lastFailure
                    ?.status,
            ).toBe(503),
        )
    })

    it('asks the worker for a soft retry on open when no token lives', async () => {
        renderHook(() => useIntegrityAccessSync())

        await waitFor(() =>
            expect(sendIntegrityControl).toHaveBeenCalledWith({
                kind: 'retry',
                soft: true,
            }),
        )
    })

    it('asks nothing on open while a token lives', async () => {
        await fake.chrome.storage.session.set({
            [INTEGRITY_TOKEN_SESSION_KEY]: liveToken(),
        })

        renderHook(() => useIntegrityAccessSync())
        await waitFor(() =>
            expect(useIntegrityAccessStore.getState().snapshot).not.toBeNull(),
        )

        expect(sendIntegrityControl).not.toHaveBeenCalled()
    })

    it('asks for a soft retry when the device comes back online', async () => {
        await fake.chrome.storage.session.set({
            [INTEGRITY_TOKEN_SESSION_KEY]: liveToken(),
        })
        act(() => useNetworkStatusStore.getState().setHasInternet(false))
        renderHook(() => useIntegrityAccessSync())

        act(() => useNetworkStatusStore.getState().setHasInternet(true))

        expect(sendIntegrityControl).toHaveBeenCalledWith({
            kind: 'retry',
            soft: true,
        })
    })

    it('reports a refused token to the worker and emphasizes the banner', () => {
        renderHook(() => useIntegrityAccessSync())
        const handler = vi.mocked(setOnIntegrityRefused).mock.calls.at(-1)?.[0]

        act(() => handler?.(refusal(true)))

        expect(sendIntegrityControl).toHaveBeenCalledWith({
            kind: 'token-rejected',
            tokenExpiresAt: null,
        })
        expect(useIntegrityFeedbackStore.getState().emphasisNonce).toBe(1)
    })

    it('only emphasizes a refusal that carried no token', () => {
        renderHook(() => useIntegrityAccessSync())
        const handler = vi.mocked(setOnIntegrityRefused).mock.calls.at(-1)?.[0]
        vi.mocked(sendIntegrityControl).mockClear()

        act(() => handler?.(refusal(false)))

        expect(sendIntegrityControl).not.toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'token-rejected' }),
        )
        expect(useIntegrityFeedbackStore.getState().emphasisNonce).toBe(1)
    })

    describe('the token wait', () => {
        const registeredWaiter = () =>
            vi.mocked(setIntegrityTokenWaiter).mock.calls.at(-1)?.[0] as
                | (() => Promise<void>)
                | null

        it('waits for a token that is on its way, up to three seconds', async () => {
            vi.useFakeTimers()
            renderHook(() => useIntegrityAccessSync())
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })
            let isDone = false
            void registeredWaiter()?.().then(() => {
                isDone = true
            })

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2900)
            })
            expect(isDone).toBe(false)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(200)
            })
            expect(isDone).toBe(true)
        })

        it('stops waiting the moment a token lands', async () => {
            renderHook(() => useIntegrityAccessSync())
            await waitFor(() =>
                expect(
                    useIntegrityAccessStore.getState().snapshot,
                ).not.toBeNull(),
            )
            vi.useFakeTimers()
            let isDone = false
            void registeredWaiter()?.().then(() => {
                isDone = true
            })

            // The request reads its bearer from this store, so that is what the wait watches.
            act(() =>
                useAppIntegrityStore.getState().setRegistration({
                    integrityToken: 'jwt',
                    expiresAt: liveToken().expiresAt,
                    keyId: null,
                    deviceInstallationId: 'install-1',
                }),
            )
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })

            expect(isDone).toBe(true)
        })

        it('does not wait once the worker reported an outage', async () => {
            await fake.chrome.storage.session.set({
                [INTEGRITY_LAST_FAILURE_SESSION_KEY]: {
                    phase: 'mint',
                    status: 503,
                    at: Date.now(),
                    isTransport: false,
                },
            })
            renderHook(() => useIntegrityAccessSync())
            await waitFor(() =>
                expect(
                    useIntegrityAccessStore.getState().snapshot,
                ).not.toBeNull(),
            )
            vi.useFakeTimers()

            let isDone = false
            void registeredWaiter()?.().then(() => {
                isDone = true
            })
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })

            expect(isDone).toBe(true)
        })
    })

    it('refetches what failed for want of a token once one lands', async () => {
        const invalidate = vi
            .spyOn(queryClient, 'invalidateQueries')
            .mockResolvedValue()
        renderHook(() => useIntegrityAccessSync())
        await waitFor(() =>
            expect(useIntegrityAccessStore.getState().snapshot).not.toBeNull(),
        )

        await act(() =>
            fake.chrome.storage.session.set({
                [INTEGRITY_TOKEN_SESSION_KEY]: liveToken(),
            }),
        )

        await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
        const { predicate } = invalidate.mock.calls[0][0] as {
            predicate: (query: { state: { error: unknown } }) => boolean
        }
        expect(predicate({ state: { error: refusal(false) } })).toBe(true)
        expect(predicate({ state: { error: new Error('other') } })).toBe(false)
    })
})
