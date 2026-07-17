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
})
