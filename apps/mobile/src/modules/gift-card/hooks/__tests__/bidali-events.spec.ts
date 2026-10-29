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

import { describe, expect, it, vi } from 'vitest'
import type WebView from 'react-native-webview'
import { sendBidaliEvent } from '../bidali-events'

vi.mock('react-native-webview', () => ({ default: {} }))

const createRef = () => {
    const injectJavaScript = vi.fn()
    const webviewRef = {
        current: { injectJavaScript } as unknown as WebView,
    }
    return { injectJavaScript, webviewRef }
}

const runInPage = (script: string, bidaliProvider: Record<string, unknown>) =>
    new Function('window', script)({ bidaliProvider })

describe('sendBidaliEvent', () => {
    it('calls the matching provider callback once in the page', () => {
        const { injectJavaScript, webviewRef } = createRef()
        const paymentSent = vi.fn()
        const paymentCancelled = vi.fn()

        sendBidaliEvent(webviewRef, 'paymentSent')
        runInPage(injectJavaScript.mock.calls[0][0] as string, {
            paymentSent,
            paymentCancelled,
        })

        expect(paymentSent).toHaveBeenCalledOnce()
        expect(paymentCancelled).not.toHaveBeenCalled()
    })

    it('does not throw in the page when the callback is absent', () => {
        const { injectJavaScript, webviewRef } = createRef()

        sendBidaliEvent(webviewRef, 'paymentCancelled')

        expect(() =>
            runInPage(injectJavaScript.mock.calls[0][0] as string, {}),
        ).not.toThrow()
    })

    it('does nothing when the webview is not mounted', () => {
        expect(() =>
            sendBidaliEvent({ current: null }, 'paymentSent'),
        ).not.toThrow()
    })
})
