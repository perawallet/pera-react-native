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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CHANNEL_HANDSHAKE_EVENT, CHANNEL_RELAY_READY_EVENT } from '../channel'
import { installMainProvider } from '../inject-main'

describe('inject-main provider', () => {
    beforeEach(() => {
        document.head.innerHTML = ''
        document.body.innerHTML = ''
    })

    it('forwards an arc0027 request to the relay channel and posts the response back', async () => {
        const relayCalls: unknown[] = []
        // Stub the isolated relay: echo a canned discover response for the request.
        const detachRelay = (() => {
            const handler = (e: Event) => {
                const { id, request } = (e as CustomEvent).detail
                relayCalls.push(request)
                window.dispatchEvent(
                    new CustomEvent(installMainProvider.__responseEventName, {
                        detail: {
                            id,
                            response: {
                                id: 'resp',
                                requestId: request.id,
                                reference: 'arc0027:discover:response',
                                result: { providerId: 'pera-wallet' },
                            },
                        },
                    }),
                )
            }
            window.addEventListener(
                installMainProvider.__requestEventName,
                handler,
            )
            return () =>
                window.removeEventListener(
                    installMainProvider.__requestEventName,
                    handler,
                )
        })()

        installMainProvider()

        const responses: unknown[] = []
        window.addEventListener('message', e => {
            if (e.source && e.source !== window) return
            if (e.data?.reference === 'arc0027:discover:response')
                responses.push(e.data)
        })

        // Use dispatchEvent with an explicit `source` rather than
        // window.postMessage: jsdom's postMessage always delivers
        // MessageEvent.source as null, which would not exercise the
        // production `event.source !== window` guard.
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { id: 'r1', reference: 'arc0027:discover:request' },
                source: window,
            }),
        )

        await vi.waitFor(() => expect(responses.length).toBe(1))
        expect((relayCalls[0] as { id: string }).id).toBe('r1')
        expect(
            (responses[0] as { result: { providerId: string } }).result
                .providerId,
        ).toBe('pera-wallet')
        detachRelay()
    })

    it('re-dispatches the handshake with the same channel names when the relay signals it is ready', async () => {
        // installMainProvider() already ran once at module-load time (top of
        // inject-main.ts), so its idempotent-install guard makes this call a
        // no-op — mirroring production, where the RELAY_READY listener is
        // registered exactly once, at real install. This test only exercises
        // that already-registered listener reacting to RELAY_READY.
        installMainProvider()

        const handshakes: {
            requestEventName: string
            responseEventName: string
        }[] = []
        window.addEventListener(CHANNEL_HANDSHAKE_EVENT, e => {
            handshakes.push(
                (e as CustomEvent).detail as {
                    requestEventName: string
                    responseEventName: string
                },
            )
        })

        // Simulate the isolated relay loading after MAIN's initial handshake
        // dispatch was dropped (no listener yet), and announcing readiness.
        window.dispatchEvent(new CustomEvent(CHANNEL_RELAY_READY_EVENT))

        expect(handshakes).toEqual([
            {
                requestEventName: installMainProvider.__requestEventName,
                responseEventName: installMainProvider.__responseEventName,
            },
        ])
    })

    it('ignores non-arc0027 window messages', async () => {
        installMainProvider()
        const seen: unknown[] = []
        window.addEventListener(installMainProvider.__requestEventName, e =>
            seen.push((e as CustomEvent).detail),
        )
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { hello: 'world' },
                source: window,
            }),
        )
        await new Promise(r => setTimeout(r, 10))
        expect(seen).toEqual([])
    })

    // These used to be dropped before the pending entry and its 120s timeout
    // were armed, so the dApp's promise never settled at all.
    describe('a request naming a method Pera does not implement', () => {
        const postAndCollect = async (
            data: unknown,
        ): Promise<{ forwarded: unknown[]; replies: unknown[] }> => {
            installMainProvider()
            const forwarded: unknown[] = []
            const replies: unknown[] = []
            window.addEventListener(installMainProvider.__requestEventName, e =>
                forwarded.push((e as CustomEvent).detail),
            )
            window.addEventListener('message', (e: MessageEvent) => {
                // Same-window only, matching the provider's own guard. `null`
                // is allowed here but not in production: jsdom reports
                // `source: null` for the provider's `window.postMessage`
                // replies, which are what this collector exists to observe.
                if (e.source && e.source !== window) return
                // Exclude our own dispatched message: this listener sees it
                // too, and a response-shaped input would otherwise look like a
                // reply the provider never sent.
                if (e.data === data) return
                const d = e.data as { requestId?: string } | null
                if (d && typeof d.requestId === 'string') replies.push(d)
            })
            window.dispatchEvent(
                new MessageEvent('message', { data, source: window }),
            )
            await new Promise(r => setTimeout(r, 10))
            return { forwarded, replies }
        }

        // The ARC-0027 spec's own method names differ from the
        // avm-web-provider names implemented here, so a dApp written against
        // the spec text lands squarely on this path.
        it('answers 4003 instead of leaving the promise pending', async () => {
            const { forwarded, replies } = await postAndCollect({
                id: 'req-1',
                reference: 'arc0027:signTxns:request',
                params: {},
            })

            expect(forwarded).toEqual([])
            expect(replies).toHaveLength(1)
            expect(replies[0]).toMatchObject({
                requestId: 'req-1',
                error: { code: 4003 },
            })
            expect(
                (replies[0] as { error: { message: string } }).error.message,
            ).toContain('signTxns')
        })

        it('still ignores a foreign namespace entirely', async () => {
            const { forwarded, replies } = await postAndCollect({
                id: 'req-2',
                reference: 'someotherwallet:enable:request',
            })

            expect(forwarded).toEqual([])
            expect(replies).toEqual([])
        })

        it('does not answer arc0027 responses flowing back to the page', async () => {
            const { forwarded, replies } = await postAndCollect({
                id: 'resp-1',
                requestId: 'req-3',
                reference: 'arc0027:enable:response',
                result: {},
            })

            expect(forwarded).toEqual([])
            expect(replies).toEqual([])
        })
    })
})
