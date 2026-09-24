/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import { isTrustedExtensionPageSender } from '../trusted-sender'
import { createChromeFake } from '../test-utils/chrome'

describe('isTrustedExtensionPageSender', () => {
    const { chrome: chromeLike } = createChromeFake()

    it('returns false when sender is undefined', () => {
        expect(isTrustedExtensionPageSender(undefined, chromeLike)).toBe(false)
    })

    it('returns false when sender.url is missing', () => {
        expect(
            isTrustedExtensionPageSender(
                { id: 'test-extension-id' } as chrome.runtime.MessageSender,
                chromeLike,
            ),
        ).toBe(false)
    })

    it('returns false when sender.id does not match the extension', () => {
        expect(
            isTrustedExtensionPageSender(
                {
                    id: 'some-other-extension',
                    url: 'chrome-extension://test-extension-id/popup.html',
                } as chrome.runtime.MessageSender,
                chromeLike,
            ),
        ).toBe(false)
    })

    it('returns false for a content-script-shaped sender (web-page url)', () => {
        expect(
            isTrustedExtensionPageSender(
                {
                    id: 'test-extension-id',
                    url: 'https://dapp.example',
                } as chrome.runtime.MessageSender,
                chromeLike,
            ),
        ).toBe(false)
    })

    it('returns true for any of our own extension pages', () => {
        for (const page of [
            'popup.html',
            'expanded.html',
            'approval.html',
            'offscreen.html',
        ]) {
            expect(
                isTrustedExtensionPageSender(
                    {
                        id: 'test-extension-id',
                        url: `chrome-extension://test-extension-id/${page}`,
                    } as chrome.runtime.MessageSender,
                    chromeLike,
                ),
            ).toBe(true)
        }
    })

    it('returns true for the service worker itself (also extension-origin)', () => {
        expect(
            isTrustedExtensionPageSender(
                {
                    id: 'test-extension-id',
                    url: 'chrome-extension://test-extension-id/service-worker-loader.js',
                } as chrome.runtime.MessageSender,
                chromeLike,
            ),
        ).toBe(true)
    })
})
