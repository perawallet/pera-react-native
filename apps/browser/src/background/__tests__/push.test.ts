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

vi.mock('firebase/messaging/sw', () => ({
    getMessaging: vi.fn(),
    onBackgroundMessage: vi.fn(),
}))
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getFirebaseApp: vi.fn(),
}))

import { handleBackgroundMessage, handleNotificationClick } from '../push'

const showNotification = vi.fn(async () => {})
const create = vi.fn(async () => ({ id: 1 }))

beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'self', {
        configurable: true,
        value: { registration: { showNotification } },
    })
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
        tabs: { create },
        runtime: { getURL: (p: string) => `chrome-extension://abc/${p}` },
    }
})

describe('handleBackgroundMessage', () => {
    it('renders the payload title, body and deeplink', async () => {
        await handleBackgroundMessage({
            data: {
                title: 'Payment received',
                body: '5 ALGO',
                url: 'perawallet://asset/0',
            },
        } as never)

        expect(showNotification).toHaveBeenCalledWith(
            'Payment received',
            expect.objectContaining({
                body: '5 ALGO',
                data: { peraUrl: 'perawallet://asset/0' },
            }),
        )
    })

    // userVisibleOnly is hardcoded true in the SDK: skipping the notification
    // for a malformed payload makes Chrome show its own generic toast instead.
    it('still shows a notification when the payload carries no data', async () => {
        await handleBackgroundMessage({} as never)

        expect(showNotification).toHaveBeenCalledWith(
            'Pera Wallet',
            expect.objectContaining({ data: { peraUrl: undefined } }),
        )
    })
})

describe('handleNotificationClick', () => {
    it('opens the expanded surface with the deeplink', () => {
        const close = vi.fn()
        const waitUntil = vi.fn()

        handleNotificationClick({
            notification: {
                data: { peraUrl: 'perawallet://asset/0' },
                close,
            },
            waitUntil,
        } as never)

        expect(close).toHaveBeenCalled()
        expect(create).toHaveBeenCalledWith({
            url: 'chrome-extension://abc/expanded.html?deeplink=perawallet%3A%2F%2Fasset%2F0',
        })
    })

    it('ignores notifications it did not create', () => {
        const close = vi.fn()

        handleNotificationClick({
            notification: { data: {}, close },
            waitUntil: vi.fn(),
        } as never)

        expect(create).not.toHaveBeenCalled()
        expect(close).not.toHaveBeenCalled()
    })
})
