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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDappRequest } from '../useDappRequest.web'

const sendMessage = vi.fn()

beforeEach(() => {
    sendMessage.mockReset()
    // @ts-expect-error test global
    globalThis.chrome = { runtime: { sendMessage } }
    // Redefining the property descriptor (rather than `delete` + assign a
    // real URL/Location) avoids jsdom's Location setter treating the
    // reassignment as an actual page navigation, which tears down `document`
    // out from under testing-library's cleanup().
    Object.defineProperty(window, 'location', {
        value: { search: '?requestId=q1' },
        writable: true,
        configurable: true,
    })
    // jsdom's window.close() is a real teardown (deletes window._document),
    // not a no-op — approve()/reject() call it as belt-and-suspenders after
    // resolving, so stub it or every subsequent render/cleanup in the suite
    // breaks.
    vi.spyOn(window, 'close').mockImplementation(() => {})
})

describe('useDappRequest', () => {
    it('loads the pending approval for the query requestId', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
        })
        const { result } = renderHook(() => useDappRequest())
        await waitFor(() =>
            expect(result.current.approval?.origin).toBe('https://x.com'),
        )
        expect(sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'get-approval', requestId: 'q1' }),
        )
    })

    it('approve() posts resolve-approval with the chosen addresses', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
        })
        sendMessage.mockResolvedValueOnce({ ok: true })
        const { result } = renderHook(() => useDappRequest())
        await waitFor(() => expect(result.current.approval).not.toBeNull())
        await act(async () => result.current.approve(['ADDR']))
        expect(sendMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({
                kind: 'resolve-approval',
                requestId: 'q1',
                approvedAddresses: ['ADDR'],
            }),
        )
    })

    it('reject() posts reject-approval', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
        })
        sendMessage.mockResolvedValueOnce({ ok: true })
        const { result } = renderHook(() => useDappRequest())
        await waitFor(() => expect(result.current.approval).not.toBeNull())
        await act(async () => result.current.reject())
        expect(sendMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({
                kind: 'reject-approval',
                requestId: 'q1',
            }),
        )
    })

    it('with no ?requestId (popup surface), discovers the pending approval via get-current-approval and adopts its requestId', async () => {
        Object.defineProperty(window, 'location', {
            value: { search: '' },
            writable: true,
            configurable: true,
        })
        sendMessage.mockResolvedValueOnce({
            requestId: 'popup-r1',
            origin: 'https://y.com',
            kind: 'enable',
        })
        const { result } = renderHook(() => useDappRequest())
        await waitFor(() =>
            expect(result.current.approval?.origin).toBe('https://y.com'),
        )
        expect(sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'get-current-approval' }),
        )
        expect(result.current.requestId).toBe('popup-r1')
    })

    it('rejects best-effort on pagehide while unsettled, and does not double-reject after an explicit reject', async () => {
        sendMessage.mockResolvedValueOnce({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
        })
        const { result } = renderHook(() => useDappRequest())
        await waitFor(() => expect(result.current.approval).not.toBeNull())

        sendMessage.mockClear()
        window.dispatchEvent(new Event('pagehide'))
        await waitFor(() =>
            expect(sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'reject-approval',
                    requestId: 'q1',
                }),
            ),
        )
        expect(sendMessage).toHaveBeenCalledTimes(1)

        sendMessage.mockClear()
        sendMessage.mockResolvedValueOnce({ ok: true })
        await act(async () => result.current.reject())
        sendMessage.mockClear()
        window.dispatchEvent(new Event('pagehide'))
        expect(sendMessage).not.toHaveBeenCalled()
    })

    // MV3 evicts the service worker while an approval window sits idle, taking
    // its in-memory pending map with it. The bridge then answers
    // 'unknown request' — and closing the window on that told the user they had
    // approved something the dApp never received.
    describe('when the bridge can no longer settle the request', () => {
        const loadApproval = async (): Promise<
            ReturnType<
                typeof renderHook<ReturnType<typeof useDappRequest>, void>
            >
        > => {
            sendMessage.mockResolvedValueOnce({
                requestId: 'q1',
                origin: 'https://x.com',
                kind: 'enable',
            })
            const rendered = renderHook(() => useDappRequest())
            await waitFor(() =>
                expect(rendered.result.current.approval).not.toBeNull(),
            )
            return rendered
        }

        it('keeps the window open and reports the failure when approve is not acknowledged', async () => {
            const { result } = await loadApproval()
            sendMessage.mockResolvedValueOnce({
                ok: false,
                error: 'unknown request',
            })

            await act(async () => result.current.approve(['ADDR']))

            expect(window.close).not.toHaveBeenCalled()
            await waitFor(() => expect(result.current.deliveryError).toBe(true))
        })

        it('keeps the window open when the send itself rejects', async () => {
            const { result } = await loadApproval()
            sendMessage.mockRejectedValueOnce(
                new Error(
                    'The message port closed before a response was received.',
                ),
            )

            await act(async () => result.current.approve(['ADDR']))

            expect(window.close).not.toHaveBeenCalled()
            await waitFor(() => expect(result.current.deliveryError).toBe(true))
        })

        // The user asked to dismiss and has nothing to act on — the dApp sees
        // its own timeout rather than a fabricated approval.
        it('still closes on an unacknowledged reject', async () => {
            const { result } = await loadApproval()
            sendMessage.mockResolvedValueOnce({
                ok: false,
                error: 'unknown request',
            })

            await act(async () => result.current.reject())

            expect(window.close).toHaveBeenCalled()
            expect(result.current.deliveryError).toBe(false)
        })
    })
})
