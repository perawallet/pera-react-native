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

// @vitest-environment-options {"url": "https://app.uniswap.org/swap"}

// Runs the real injected provider in jsdom and plays the native side by hand,
// so the page-side wire and the transport's message validator are checked
// against each other.

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import {
    EIP1193_DELIVER_GLOBAL,
    isEip1193PageMessage,
} from '../../../utils/webViewDappTransport'
import { eip1193ProviderJS } from '../eip1193-injected-script'

const TOKEN = 'test-bridge-token-123'

type Provider = {
    isPera: true
    request: (args: { method: string; params?: unknown }) => Promise<unknown>
    on: (event: string, listener: (payload: unknown) => void) => unknown
}

type PageWindow = typeof window & {
    ethereum?: Provider
    ReactNativeWebView?: { postMessage: (data: string) => void }
    __peraEip1193Installed?: boolean
}

const page = window as PageWindow

type Posted = {
    token: string
    hasUserActivation: boolean
    request: { id: string; method: string; params?: unknown }
}

const posted = (
    postMessage: Mock<(data: string) => void>,
    index = -1,
): Posted =>
    JSON.parse(postMessage.mock.calls.at(index)?.[0] as string) as Posted

const deliver = (message: unknown): void =>
    (page as unknown as Record<string, (m: unknown) => void>)[
        EIP1193_DELIVER_GLOBAL
    ](message)

const install = (): void => {
    // eslint-disable-next-line no-new-func
    new Function(eip1193ProviderJS(TOKEN))()
}

describe('eip1193ProviderJS', () => {
    let postMessage: Mock<(data: string) => void>

    beforeEach(() => {
        postMessage = vi.fn()
        page.ReactNativeWebView = { postMessage }
        delete page.ethereum
        delete page.__peraEip1193Installed
    })

    afterEach(() => {
        delete page.ReactNativeWebView
        delete page.ethereum
        delete page.__peraEip1193Installed
    })

    it('takes window.ethereum when it is free', () => {
        install()

        expect(page.ethereum?.isPera).toBe(true)
    })

    it('leaves an existing window.ethereum alone', () => {
        const other = { isOther: true }
        Object.defineProperty(page, 'ethereum', {
            value: other,
            configurable: true,
            writable: true,
        })

        install()

        expect(page.ethereum).toBe(other)
    })

    it('announces Pera through EIP-6963 on install and on request', () => {
        const announced: {
            info: { name: string; rdns: string; icon: string }
        }[] = []
        const listener = (event: Event) =>
            announced.push((event as CustomEvent).detail)
        window.addEventListener('eip6963:announceProvider', listener)

        install()
        const afterInstall = announced.length
        window.dispatchEvent(new Event('eip6963:requestProvider'))
        window.removeEventListener('eip6963:announceProvider', listener)

        // Earlier tests' installs share this window and answer the request too.
        expect(afterInstall).toBeGreaterThan(0)
        expect(announced.length).toBeGreaterThan(afterInstall)
        expect(announced[0].info).toMatchObject({
            name: 'Pera Wallet',
            rdns: 'app.perawallet',
        })
        expect(announced[0].info.icon.startsWith('data:image/svg+xml')).toBe(
            true,
        )
    })

    it('posts a token-stamped request that the native validator accepts', () => {
        install()

        void page.ethereum?.request({ method: 'eth_chainId' })

        const message = posted(postMessage)
        expect(message.token).toBe(TOKEN)
        expect(isEip1193PageMessage(message)).toBe(true)
        expect(message.request.method).toBe('eth_chainId')
    })

    it('resolves a request with the delivered result', async () => {
        install()
        const pending = page.ethereum?.request({ method: 'eth_chainId' })

        deliver({
            jsonrpc: '2.0',
            id: posted(postMessage).request.id,
            result: '0x1',
        })

        await expect(pending).resolves.toBe('0x1')
    })

    it('rejects with the delivered error code', async () => {
        install()
        const pending = page.ethereum?.request({
            method: 'eth_requestAccounts',
        })

        deliver({
            jsonrpc: '2.0',
            id: posted(postMessage).request.id,
            error: { code: 4001, message: 'The user rejected the request' },
        })

        await expect(pending).rejects.toMatchObject({ code: 4001 })
    })

    it('ignores an answer for an id it never sent', () => {
        install()

        expect(() =>
            deliver({ jsonrpc: '2.0', id: 'unknown', result: '0x1' }),
        ).not.toThrow()
    })

    it('emits accountsChanged and chainChanged from delivered notifications', () => {
        install()
        const accounts = vi.fn()
        const chain = vi.fn()
        page.ethereum?.on('accountsChanged', accounts)
        page.ethereum?.on('chainChanged', chain)

        deliver({
            jsonrpc: '2.0',
            method: 'accountsChanged',
            params: ['0xabc'],
        })
        deliver({ jsonrpc: '2.0', method: 'chainChanged', params: '0x2105' })

        expect(accounts).toHaveBeenCalledWith(['0xabc'])
        expect(chain).toHaveBeenCalledWith('0x2105')
    })

    it('shares one in-flight eth_requestAccounts between concurrent callers', () => {
        install()

        const first = page.ethereum?.request({ method: 'eth_requestAccounts' })
        const second = page.ethereum?.request({ method: 'eth_requestAccounts' })

        expect(second).toBe(first)
        expect(postMessage).toHaveBeenCalledTimes(1)
    })

    it('reports no user activation for a scripted click', () => {
        install()

        window.dispatchEvent(new Event('pointerdown'))
        void page.ethereum?.request({ method: 'eth_requestAccounts' })

        expect(posted(postMessage).hasUserActivation).toBe(false)
    })

    it('installs nothing on a page that is not https', () => {
        // The script reads a bare `location`, so a parameter of that name shadows jsdom's.
        // eslint-disable-next-line no-new-func
        new Function('location', eip1193ProviderJS(TOKEN))({
            protocol: 'http:',
        })

        expect(page.ethereum).toBeUndefined()
    })

    it('installs once however often the script runs', () => {
        install()
        const first = page.ethereum
        install()

        expect(page.ethereum).toBe(first)
    })

    it('rejects an unanswered request after the page backstop and posts again on the next call', async () => {
        vi.useFakeTimers()
        try {
            install()
            const first = page.ethereum?.request({
                method: 'eth_requestAccounts',
            })
            const settled = expect(first).rejects.toMatchObject({ code: 4900 })

            await vi.advanceTimersByTimeAsync(5 * 60_000 + 10_000)
            await settled

            void page.ethereum?.request({ method: 'eth_requestAccounts' })
            expect(postMessage).toHaveBeenCalledTimes(2)
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps a queued signing request waiting past the plain backstop', async () => {
        vi.useFakeTimers()
        try {
            install()
            const onRejected = vi.fn()
            page.ethereum
                ?.request({ method: 'personal_sign', params: ['0x', '0x'] })
                .catch(onRejected)

            await vi.advanceTimersByTimeAsync(5 * 60_000 + 10_000)
            expect(onRejected).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(14 * 60_000)
            expect(onRejected).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not time out a request that was answered', async () => {
        vi.useFakeTimers()
        try {
            install()
            const pending = page.ethereum?.request({ method: 'eth_chainId' })
            deliver({
                jsonrpc: '2.0',
                id: posted(postMessage).request.id,
                result: '0x1',
            })

            await expect(pending).resolves.toBe('0x1')
            await vi.advanceTimersByTimeAsync(20 * 60_000)
        } finally {
            vi.useRealTimers()
        }
    })

    it('rejects with 4900 when the native bridge is missing', async () => {
        delete page.ReactNativeWebView
        install()

        await expect(
            page.ethereum?.request({ method: 'eth_chainId' }),
        ).rejects.toMatchObject({ code: 4900 })
    })
})
