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

import { describe, it, expect } from 'vitest'
import {
    CONNECT_MODAL_WRAPPER_ID,
    extractUriFromConnectModal,
    isWcUri,
} from '../connect-modal-uri'

const VALID_URI =
    'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=00&algorand=true'

describe('isWcUri', () => {
    it('accepts a wc: URI', () => {
        expect(isWcUri(VALID_URI)).toBe(true)
    })

    it('accepts a perawallet-wc: URI', () => {
        expect(isWcUri('perawallet-wc:topic@1?bridge=b&key=00')).toBe(true)
    })

    it('rejects another scheme', () => {
        expect(isWcUri('https://evil.example')).toBe(false)
    })

    it('rejects a non-string', () => {
        expect(isWcUri(null)).toBe(false)
        expect(isWcUri(42)).toBe(false)
    })

    it('rejects an over-long value', () => {
        expect(isWcUri(`wc:${'a'.repeat(5000)}`)).toBe(false)
    })
})

describe('extractUriFromConnectModal', () => {
    it('reads the uri attribute off the custom element', () => {
        const wrapper = document.createElement('div')
        wrapper.id = CONNECT_MODAL_WRAPPER_ID
        const modal = document.createElement('pera-wallet-connect-modal')
        modal.setAttribute('uri', VALID_URI)
        wrapper.appendChild(modal)

        expect(extractUriFromConnectModal(wrapper)).toBe(VALID_URI)
    })

    it('falls back to the legacy launch-button class', () => {
        const wrapper = document.createElement('div')
        const legacy = document.createElement('a')
        legacy.className =
            'pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button'
        legacy.setAttribute('href', VALID_URI)
        wrapper.appendChild(legacy)

        expect(extractUriFromConnectModal(wrapper)).toBe(VALID_URI)
    })

    it('returns null for a null wrapper', () => {
        expect(extractUriFromConnectModal(null)).toBeNull()
    })

    it('returns null when no uri is present anywhere', () => {
        const wrapper = document.createElement('div')
        wrapper.appendChild(document.createElement('pera-wallet-connect-modal'))

        expect(extractUriFromConnectModal(wrapper)).toBeNull()
    })

    it('returns null when the attribute holds a non-wc value', () => {
        const wrapper = document.createElement('div')
        const modal = document.createElement('pera-wallet-connect-modal')
        modal.setAttribute('uri', 'javascript:alert(1)')
        wrapper.appendChild(modal)

        expect(extractUriFromConnectModal(wrapper)).toBeNull()
    })

    it('extracts uri from shadow-root nested launch button', () => {
        const wrapper = document.createElement('div')
        const modal = document.createElement('pera-wallet-connect-modal')
        wrapper.appendChild(modal)

        const modalShadow = modal.attachShadow({ mode: 'open' })
        const touch = document.createElement(
            'pera-wallet-modal-touch-screen-mode',
        )
        modalShadow.appendChild(touch)

        const touchShadow = touch.attachShadow({ mode: 'open' })
        const btn = document.createElement('a')
        btn.id =
            'pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button'
        btn.setAttribute('href', VALID_URI)
        touchShadow.appendChild(btn)

        expect(extractUriFromConnectModal(wrapper)).toBe(VALID_URI)
    })

    it('rejects shadow-root nested button with non-wc href', () => {
        const wrapper = document.createElement('div')
        const modal = document.createElement('pera-wallet-connect-modal')
        wrapper.appendChild(modal)

        const modalShadow = modal.attachShadow({ mode: 'open' })
        const touch = document.createElement(
            'pera-wallet-modal-touch-screen-mode',
        )
        modalShadow.appendChild(touch)

        const touchShadow = touch.attachShadow({ mode: 'open' })
        const btn = document.createElement('a')
        btn.id =
            'pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button'
        btn.setAttribute('href', 'https://evil.example')
        touchShadow.appendChild(btn)

        expect(extractUriFromConnectModal(wrapper)).toBeNull()
    })
})
