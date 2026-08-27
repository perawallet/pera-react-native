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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { AppState } from 'react-native'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClientProvider,
    focusManager,
    useMutation,
    useQuery,
} from '@tanstack/react-query'
import {
    PeraServiceUnavailableError,
    logger,
} from '@perawallet/wallet-core-shared'
import type { Persister } from '@tanstack/react-query-persist-client'
import { QueryProvider, queryClient } from '../QueryProvider'
import { setOnPeraBackendUnavailable } from '../queryClient'

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('queryClient mutation error policy', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        queryClient.getMutationCache().clear()
    })

    it('defaults mutations to state errors, not render-phase throws', () => {
        expect(queryClient.getDefaultOptions().mutations?.throwOnError).toBe(
            false,
        )
    })

    it('surfaces a failed mutation as error state without crashing the tree', async () => {
        vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderHook(
            () =>
                useMutation({
                    mutationFn: () =>
                        Promise.reject(new Error('backend exploded')),
                }),
            { wrapper },
        )

        act(() => {
            result.current.mutate(undefined)
        })

        // Reaching these assertions at all is the regression: with the old
        // global `throwOnError: true`, the rejection re-threw during render.
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('backend exploded')
    })

    it('logs non-transient mutation failures centrally with the mutation key', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderHook(
            () =>
                useMutation({
                    mutationKey: ['test-mutation'],
                    mutationFn: () => Promise.reject(new Error('boom')),
                }),
            { wrapper },
        )

        act(() => {
            result.current.mutate(undefined)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(errorSpy).toHaveBeenCalledWith(
            'Mutation failed:',
            expect.objectContaining({ mutationKey: ['test-mutation'] }),
        )
    })

    it('skips central error logging for transient network failures', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        // ky's isHTTPError guard is deliberately shape-based (name match) to
        // survive cross-realm errors, so a name-shaped fake is a faithful
        // stand-in for a real 5xx HTTPError without app->ky imports.
        const transientError = Object.assign(new Error('Service unavailable'), {
            name: 'HTTPError',
            response: { status: 503 },
        })
        const { result } = renderHook(
            () =>
                useMutation({
                    mutationFn: () => Promise.reject(transientError),
                }),
            { wrapper },
        )

        act(() => {
            result.current.mutate(undefined)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('skips central error logging when the Pera service is not deployed', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderHook(
            () =>
                useMutation({
                    mutationFn: () =>
                        Promise.reject(
                            new PeraServiceUnavailableError('betanet'),
                        ),
                }),
            { wrapper },
        )

        act(() => {
            result.current.mutate(undefined)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(errorSpy).not.toHaveBeenCalled()
    })
})

describe('queryClient query error policy', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        queryClient.getQueryCache().clear()
    })

    // Every ungated Pera query does this on betanet/custom —
    // useCurrenciesQuery mounts on any screen showing a fiat value — so
    // reporting it would mean a crash-report non-fatal (and a dev RedBox) per
    // query, for an expected, permanent condition.
    it('skips central error logging when the Pera service is not deployed', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderHook(
            () =>
                useQuery({
                    queryKey: ['pera-service-unavailable'],
                    queryFn: () =>
                        Promise.reject(
                            new PeraServiceUnavailableError('betanet'),
                        ),
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(errorSpy).not.toHaveBeenCalled()
    })

    it('still logs an unrelated query failure centrally', async () => {
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

        const { result } = renderHook(
            () =>
                useQuery({
                    queryKey: ['unrelated-failure'],
                    queryFn: () => Promise.reject(new Error('boom')),
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(errorSpy).toHaveBeenCalledWith(
            'An error has occurred:',
            expect.objectContaining({ error: expect.any(Error) }),
        )
    })
})

describe('pera-service-unavailable listener wiring', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        queryClient.getQueryCache().clear()
        queryClient.getMutationCache().clear()
    })

    it('forwards a Pera service-unavailable query error to the registered handler', async () => {
        const handler = vi.fn()
        const unsubscribe = setOnPeraBackendUnavailable(handler)

        try {
            const { result } = renderHook(
                () =>
                    useQuery({
                        queryKey: ['pera-listener-query'],
                        queryFn: () =>
                            Promise.reject(
                                new PeraServiceUnavailableError('betanet'),
                            ),
                    }),
                { wrapper },
            )

            await waitFor(() => expect(handler).toHaveBeenCalledWith('betanet'))
            expect(result.current.isError).toBe(true)
        } finally {
            unsubscribe()
        }
    })

    it('forwards a Pera service-unavailable mutation error to the registered handler', async () => {
        const handler = vi.fn()
        const unsubscribe = setOnPeraBackendUnavailable(handler)

        try {
            const { result } = renderHook(
                () =>
                    useMutation({
                        mutationFn: () =>
                            Promise.reject(
                                new PeraServiceUnavailableError('betanet'),
                            ),
                    }),
                { wrapper },
            )

            act(() => {
                result.current.mutate(undefined)
            })

            await waitFor(() => expect(handler).toHaveBeenCalledWith('betanet'))
        } finally {
            unsubscribe()
        }
    })

    it('does not forward an unrelated query failure to the handler', async () => {
        const handler = vi.fn()
        const unsubscribe = setOnPeraBackendUnavailable(handler)

        try {
            const { result } = renderHook(
                () =>
                    useQuery({
                        queryKey: ['unrelated-listener-query'],
                        queryFn: () => Promise.reject(new Error('boom')),
                    }),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(handler).not.toHaveBeenCalled()
        } finally {
            unsubscribe()
        }
    })
})

describe('queryClient focus policy', () => {
    it('keeps refetch-on-focus off so focus wiring only pauses background polls', () => {
        expect(
            queryClient.getDefaultOptions().queries?.refetchOnWindowFocus,
        ).toBe(false)
    })
})

describe('focusManager wiring', () => {
    const noopPersister: Persister = {
        persistClient: vi.fn(),
        restoreClient: vi.fn(async () => undefined),
        removeClient: vi.fn(),
    }

    afterEach(() => {
        focusManager.setFocused(undefined)
        vi.restoreAllMocks()
    })

    it('follows AppState transitions and unsubscribes on unmount', () => {
        let listener: ((state: string) => void) | undefined
        const remove = vi.fn()
        vi.spyOn(AppState, 'addEventListener').mockImplementation(
            (_event, handler) => {
                listener = handler as (state: string) => void
                return { remove } as ReturnType<
                    typeof AppState.addEventListener
                >
            },
        )

        const { unmount } = render(
            <QueryProvider persister={noopPersister}>{null}</QueryProvider>,
        )

        act(() => listener?.('background'))
        expect(focusManager.isFocused()).toBe(false)

        act(() => listener?.('active'))
        expect(focusManager.isFocused()).toBe(true)

        unmount()
        expect(remove).toHaveBeenCalled()
    })
})
