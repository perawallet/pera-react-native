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
import { beforeEach, describe, expect, it, vi } from 'vitest'

const makeFakeChrome = () => ({
    runtime: {
        connect: vi.fn(() => ({
            postMessage: vi.fn(),
            onMessage: { addListener: () => undefined },
            onDisconnect: { addListener: () => undefined },
        })),
    },
})

const handshake = (): void => {
    window.dispatchEvent(
        new CustomEvent('__pera_discover_handshake__', {
            detail: {
                requestEventName: 'req-evt',
                responseEventName: 'res-evt',
            },
        }),
    )
}

const loadScript = async (): Promise<void> => {
    vi.resetModules()
    await import('../bidali-relay')
}

beforeEach(() => {
    vi.stubGlobal('chrome', makeFakeChrome())
    const balances = encodeURIComponent(JSON.stringify({ algorand: '12.5' }))
    window.history.replaceState(
        null,
        '',
        `/?key=public-key&peraBidaliBalances=${balances}&peraBridgeToken=t1`,
    )
})

describe('bidali-relay content script', () => {
    it('scrubs the bridge token and the balances off the URL once the handshake lands', async () => {
        await loadScript()

        handshake()

        const params = new URLSearchParams(window.location.search)
        expect(params.has('peraBridgeToken')).toBe(false)
        expect(params.has('peraBidaliBalances')).toBe(false)
    })

    it('leaves the Bidali key, which native puts on the URL too', async () => {
        await loadScript()

        handshake()

        expect(new URLSearchParams(window.location.search).get('key')).toBe(
            'public-key',
        )
    })
})
