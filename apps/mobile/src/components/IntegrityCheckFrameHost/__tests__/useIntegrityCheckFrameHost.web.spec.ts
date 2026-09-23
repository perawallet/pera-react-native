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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIntegrityCheckFrameHost } from '../useIntegrityCheckFrameHost.web'
import { useIntegrityCheckFrameStore } from '../useIntegrityCheckFrameStore.web'

const CHECK_ORIGIN = 'https://integrity-staging.perawallet.app'
const CHECK_URL = `${CHECK_ORIGIN}/check?v=1&kid=k&peraCheckToken=t`

const mocks = vi.hoisted(() => {
    const release = vi.fn()
    return {
        request: vi.fn(),
        release,
        hold: vi.fn((_url: string) => release),
        neededListener: null as (() => void) | null,
        endedListener: null as (() => void) | null,
        surface: 'popup',
        isOnboarding: false,
    }
})

vi.mock('@perawallet/wallet-extension-platform-chrome', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-extension-platform-chrome')
    >('@perawallet/wallet-extension-platform-chrome')
    return {
        ...actual,
        getSurface: () => mocks.surface,
        requestIntegrityEnrolment: (...args: unknown[]) =>
            mocks.request(...args),
        onIntegrityEnrolmentNeeded: (listener: () => void) => {
            mocks.neededListener = listener
            return () => {
                mocks.neededListener = null
            }
        },
        onHostedCheckEnded: (_url: string, listener: () => void) => {
            mocks.endedListener = listener
            return () => {
                mocks.endedListener = null
            }
        },
        holdIntegrityCheckHost: (url: string) => mocks.hold(url),
    }
})

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        config: {
            ...actual.config,
            integrityCheckOrigin: 'https://integrity-staging.perawallet.app',
        },
    }
})

vi.mock('@hooks/useShowOnboarding', () => ({
    useShowOnboarding: () => mocks.isOnboarding,
}))

// Lets the request's decision settle, so a "never framed" assertion cannot
// pass merely because it ran before the answer arrived.
const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve()
    }
}

const host = {
    action: 'host',
    url: CHECK_URL,
    deadlineAt: Date.now() + 240_000,
}

describe('useIntegrityCheckFrameHost', () => {
    beforeEach(() => {
        mocks.request.mockReset()
        mocks.hold.mockClear()
        mocks.release.mockClear()
        mocks.neededListener = null
        mocks.endedListener = null
        mocks.surface = 'popup'
        mocks.isOnboarding = false
        useIntegrityCheckFrameStore.getState().hide()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('asks on open once onboarding is done, and frames what the worker answers', async () => {
        mocks.request.mockResolvedValue(host)

        const { result } = renderHook(() => useIntegrityCheckFrameHost())

        await vi.waitFor(() => expect(result.current.url).toBe(CHECK_URL))
        expect(mocks.request).toHaveBeenCalledWith('page-open')
        expect(result.current.isExpanded).toBe(false)
    })

    it('never asks from an approval window', () => {
        mocks.surface = 'approval'
        renderHook(() => useIntegrityCheckFrameHost())

        expect(mocks.request).not.toHaveBeenCalled()
    })

    it('waits through onboarding and asks the moment it finishes', async () => {
        mocks.request.mockResolvedValue({ action: 'none' })
        mocks.isOnboarding = true
        const { rerender } = renderHook(() => useIntegrityCheckFrameHost())
        expect(mocks.request).not.toHaveBeenCalled()

        mocks.isOnboarding = false
        rerender()

        await vi.waitFor(() =>
            expect(mocks.request).toHaveBeenCalledWith('onboarding-complete'),
        )
    })

    it('refuses to frame any origin but the configured check page', async () => {
        mocks.request.mockResolvedValue({
            ...host,
            url: 'https://evil.example/check',
        })

        const { result } = renderHook(() => useIntegrityCheckFrameHost())

        await vi.waitFor(() => expect(mocks.request).toHaveBeenCalled())
        await act(flushMicrotasks)

        expect(result.current.url).toBeNull()
    })

    it('asks again when the worker flags that enrolment is needed', async () => {
        mocks.request.mockResolvedValue({ action: 'none' })
        renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))

        act(() => mocks.neededListener?.())

        await vi.waitFor(() =>
            expect(mocks.request).toHaveBeenLastCalledWith('enrolment-needed'),
        )
    })

    it('ignores an enrolment-needed flag raised during onboarding', async () => {
        mocks.isOnboarding = true
        renderHook(() => useIntegrityCheckFrameHost())

        act(() => mocks.neededListener?.())
        await act(flushMicrotasks)

        expect(mocks.request).not.toHaveBeenCalled()
    })

    it('follows expand, collapse and finished from its own frame only', async () => {
        mocks.request.mockResolvedValue(host)
        const { result } = renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() => expect(result.current.url).toBe(CHECK_URL))
        const frameWindow = {} as Window
        result.current.iframeRef.current = {
            contentWindow: frameWindow,
        } as HTMLIFrameElement
        const frameSays = (event: string, source: Window = frameWindow) =>
            act(() => {
                window.dispatchEvent(
                    new MessageEvent('message', {
                        data: { type: 'pera:integrity-frame', v: 1, event },
                        origin: CHECK_ORIGIN,
                        source,
                    }),
                )
            })

        frameSays('expand', {} as Window)
        expect(result.current.isExpanded).toBe(false)

        frameSays('expand')
        expect(result.current.isExpanded).toBe(true)
        frameSays('collapse')
        expect(result.current.isExpanded).toBe(false)
        frameSays('finished')
        expect(result.current.url).toBeNull()
    })

    it('keeps holding the host port after the frame finishes, until the worker ends the attempt', async () => {
        mocks.request.mockResolvedValue(host)
        const { result } = renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() => expect(result.current.url).toBe(CHECK_URL))
        const frameWindow = {} as Window
        result.current.iframeRef.current = {
            contentWindow: frameWindow,
        } as HTMLIFrameElement

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        type: 'pera:integrity-frame',
                        v: 1,
                        event: 'finished',
                    },
                    origin: CHECK_ORIGIN,
                    source: frameWindow,
                }),
            )
        })

        expect(result.current.url).toBeNull()
        expect(mocks.release).not.toHaveBeenCalled()

        act(() => mocks.endedListener?.())

        expect(mocks.release).toHaveBeenCalledTimes(1)
    })

    it('holds the host port while the frame is up, and drops both once the worker ends the attempt', async () => {
        mocks.request.mockResolvedValue(host)
        const { result } = renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() =>
            expect(mocks.hold).toHaveBeenCalledWith(CHECK_URL),
        )
        expect(result.current.url).toBe(CHECK_URL)

        act(() => mocks.endedListener?.())

        expect(result.current.url).toBeNull()
        expect(mocks.release).toHaveBeenCalledTimes(1)
    })

    it('releases the host port when the page unmounts', async () => {
        mocks.request.mockResolvedValue(host)
        const { unmount } = renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() =>
            expect(mocks.hold).toHaveBeenCalledWith(CHECK_URL),
        )

        unmount()

        expect(mocks.release).toHaveBeenCalledTimes(1)
    })

    it('removes the frame at the deadline', async () => {
        vi.useFakeTimers()
        mocks.request.mockResolvedValue({
            ...host,
            deadlineAt: Date.now() + 1000,
        })
        const { result } = renderHook(() => useIntegrityCheckFrameHost())
        await vi.waitFor(() => expect(result.current.url).toBe(CHECK_URL))

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000)
        })

        expect(result.current.url).toBeNull()
    })
})
