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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KID = 'k'.repeat(43)
const TOKEN = 't'.repeat(22)
const EXTENSION_ORIGIN = 'chrome-extension://ext-id'

type FakePort = {
    name: string
    sent: unknown[]
    postMessage: (message: unknown) => void
    onDisconnect: { addListener: (fn: () => void) => void }
    disconnect: () => void
}

const ports: FakePort[] = []
const makePort = (name: string): FakePort => {
    const listeners: Array<() => void> = []
    const port: FakePort = {
        name,
        sent: [],
        postMessage: message => port.sent.push(message),
        onDisconnect: { addListener: fn => listeners.push(fn) },
        disconnect: () => listeners.forEach(fn => fn()),
    }
    ports.push(port)
    return port
}

const pageSays = (fields: Record<string, unknown>): void => {
    window.dispatchEvent(
        new MessageEvent('message', {
            data: { type: 'pera:integrity-check', v: 1, kid: KID, ...fields },
            origin: window.location.origin,
            source: window,
        }),
    )
}

const load = async (search: string): Promise<void> => {
    history.replaceState(null, '', `/check${search}`)
    vi.resetModules()
    await import('../integrity-check')
}

describe('integrity check relay', () => {
    beforeEach(() => {
        ports.length = 0
        vi.stubGlobal('chrome', {
            runtime: {
                getURL: (path: string) => `${EXTENSION_ORIGIN}/${path}`,
                connect: vi.fn(({ name }: { name: string }) => makePort(name)),
            },
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('stays silent on a page opened without a check token', async () => {
        await load('?v=1&kid=x')
        pageSays({ event: 'hello' })

        expect(chrome.runtime.connect).not.toHaveBeenCalled()
    })

    it('answers hello with ready and announces the page on a token-named port', async () => {
        const posted = vi.spyOn(window, 'postMessage')
        await load(`?v=1&kid=${KID}&peraCheckToken=${TOKEN}`)

        pageSays({ event: 'hello' })

        expect(posted).toHaveBeenCalledWith(
            { type: 'pera:integrity-check', v: 1, event: 'ready' },
            window.location.origin,
        )
        expect(ports[0]?.name).toBe(`pera-integrity-check:${TOKEN}`)
        expect(ports[0]?.sent).toEqual([{ type: 'PAGE_READY', v: 1, kid: KID }])
    })

    it('forwards the solve to the worker', async () => {
        await load(`?v=1&kid=${KID}&peraCheckToken=${TOKEN}`)
        pageSays({ event: 'hello' })

        pageSays({ event: 'solved', turnstileToken: 'tok' })

        expect(ports[0]?.sent).toContainEqual({
            type: 'TURNSTILE_SOLVED',
            v: 1,
            kid: KID,
            turnstileToken: 'tok',
        })
    })

    it('reconnects after the worker drops the port and re-announces first', async () => {
        await load(`?v=1&kid=${KID}&peraCheckToken=${TOKEN}`)
        pageSays({ event: 'hello' })
        ports[0]?.disconnect()

        pageSays({ event: 'interactive-required' })

        expect(ports).toHaveLength(2)
        expect(ports[1]?.sent).toEqual([
            { type: 'PAGE_READY', v: 1, kid: KID },
            { type: 'INTERACTIVE_REQUIRED', v: 1, kid: KID },
        ])
    })

    it('ignores messages from anywhere but the page itself', async () => {
        await load(`?v=1&kid=${KID}&peraCheckToken=${TOKEN}`)
        window.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    type: 'pera:integrity-check',
                    v: 1,
                    kid: KID,
                    event: 'hello',
                },
                origin: 'https://evil.example',
                source: window,
            }),
        )

        expect(chrome.runtime.connect).not.toHaveBeenCalled()
    })

    it('tells a hosting extension page to expand and remove the frame, never the token', async () => {
        const parentPost = vi.fn()
        vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window)
        vi.spyOn(window, 'parent', 'get').mockReturnValue({
            postMessage: parentPost,
        } as unknown as Window)
        await load(`?v=1&kid=${KID}&peraCheckToken=${TOKEN}`)
        pageSays({ event: 'hello' })

        pageSays({ event: 'interactive-required' })
        pageSays({ event: 'solved', turnstileToken: 'tok' })

        expect(parentPost.mock.calls).toEqual([
            [
                { type: 'pera:integrity-frame', v: 1, event: 'expand' },
                EXTENSION_ORIGIN,
            ],
            [
                { type: 'pera:integrity-frame', v: 1, event: 'finished' },
                EXTENSION_ORIGIN,
            ],
        ])
    })
})
