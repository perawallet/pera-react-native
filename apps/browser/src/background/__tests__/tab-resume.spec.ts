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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_RESUME_DONE_SCOPE } from '@perawallet/wallet-core-browser-runtime'
import { installTabResumeRoute } from '../tab-resume'

const EXPANDED_URL = 'chrome-extension://ext-id/expanded.html?flow=resume'

const makeChromeMock = () => {
    const listeners: ((
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void,
    ) => boolean | void)[] = []
    return {
        runtime: {
            id: 'ext-id',
            getURL: (path: string) => `chrome-extension://ext-id/${path}`,
            onMessage: {
                addListener: vi.fn(listener => listeners.push(listener)),
            },
        },
        tabs: { remove: vi.fn().mockResolvedValue(undefined) },
        action: { openPopup: vi.fn().mockResolvedValue(undefined) },
        deliver: (message: unknown, sender: unknown) => {
            const sendResponse = vi.fn()
            const keepAlive = listeners[0]?.(message, sender, sendResponse)
            return { keepAlive, sendResponse }
        },
    }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('installTabResumeRoute', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>

    beforeEach(() => {
        chromeMock = makeChromeMock()
        installTabResumeRoute({
            chromeLike: chromeMock as unknown as typeof chrome,
        })
    })

    it('closes the finished tab, then reopens the popup in its window', async () => {
        const { keepAlive, sendResponse } = chromeMock.deliver(
            { scope: TAB_RESUME_DONE_SCOPE },
            { id: 'ext-id', url: EXPANDED_URL, tab: { id: 7, windowId: 3 } },
        )
        await flush()

        expect(keepAlive).toBe(false)
        expect(sendResponse).toHaveBeenCalledWith({ ok: true })
        expect(chromeMock.tabs.remove).toHaveBeenCalledWith(7)
        expect(chromeMock.action.openPopup).toHaveBeenCalledWith({
            windowId: 3,
        })
        expect(chromeMock.tabs.remove.mock.invocationCallOrder[0]).toBeLessThan(
            chromeMock.action.openPopup.mock.invocationCallOrder[0],
        )
    })

    it("falls back to the focused window when the tab was its window's last", async () => {
        chromeMock.action.openPopup
            .mockRejectedValueOnce(new Error('No window with id: 3.'))
            .mockResolvedValueOnce(undefined)

        chromeMock.deliver(
            { scope: TAB_RESUME_DONE_SCOPE },
            { id: 'ext-id', url: EXPANDED_URL, tab: { id: 7, windowId: 3 } },
        )
        await flush()

        expect(chromeMock.action.openPopup).toHaveBeenLastCalledWith()
    })

    it.each([
        [
            'a content script, whose url is the web page',
            { id: 'ext-id', url: 'https://dapp.example/', tab: { id: 7 } },
        ],
        [
            'another extension',
            { id: 'other-ext', url: EXPANDED_URL, tab: { id: 7 } },
        ],
        ['a page without a tab', { id: 'ext-id', url: EXPANDED_URL }],
    ])('ignores the request from %s', async (_label, sender) => {
        const { sendResponse } = chromeMock.deliver(
            { scope: TAB_RESUME_DONE_SCOPE },
            sender,
        )
        await flush()

        expect(sendResponse).not.toHaveBeenCalled()
        expect(chromeMock.tabs.remove).not.toHaveBeenCalled()
        expect(chromeMock.action.openPopup).not.toHaveBeenCalled()
    })

    it('leaves other messages to their own listeners', () => {
        const { keepAlive } = chromeMock.deliver(
            { scope: 'something-else' },
            { id: 'ext-id', url: EXPANDED_URL, tab: { id: 7 } },
        )

        expect(keepAlive).toBe(false)
        expect(chromeMock.tabs.remove).not.toHaveBeenCalled()
    })
})
