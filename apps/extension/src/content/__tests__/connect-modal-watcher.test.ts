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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installConnectModalWatcher } from '../connect-modal-watcher'
import { CONNECT_MODAL_WRAPPER_ID } from '../connect-modal-uri'
import { INJECTED_ROW_ID, LAUNCH_BUTTON_ID } from '../connect-modal-row'

const VALID_URI =
    'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=00&algorand=true'

// Mirrors the real @perawallet/connect DOM, which nests two open shadow
// roots deep (see connect-modal-row.ts's module comment):
//   <pera-wallet-connect-modal>            shadow root #1
//   └── <pera-wallet-modal-desktop-mode>   shadow root #2
//       └── .pera-wallet-connect-modal-desktop-mode__default-view
const appendModal = (uri = VALID_URI): HTMLDivElement => {
    const wrapper = document.createElement('div')
    wrapper.id = CONNECT_MODAL_WRAPPER_ID
    const modal = document.createElement('pera-wallet-connect-modal')
    modal.setAttribute('uri', uri)
    const root = modal.attachShadow({ mode: 'open' })
    const desktopMode = document.createElement('pera-wallet-modal-desktop-mode')
    const desktopRoot = desktopMode.attachShadow({ mode: 'open' })
    const list = document.createElement('div')
    list.className = 'pera-wallet-connect-modal-desktop-mode__default-view'
    desktopRoot.appendChild(list)
    root.appendChild(desktopMode)
    wrapper.appendChild(modal)
    document.body.appendChild(wrapper)
    return wrapper
}

const desktopModeRoot = (wrapper: Element): ShadowRoot | null =>
    wrapper
        .querySelector('pera-wallet-connect-modal')
        ?.shadowRoot?.querySelector('pera-wallet-modal-desktop-mode')
        ?.shadowRoot ?? null

const injectedRow = (wrapper: Element): HTMLElement | null =>
    (desktopModeRoot(wrapper)?.getElementById(INJECTED_ROW_ID) ??
        null) as HTMLElement | null

// The pairing is driven by the launch button inside the expanded panel, not by
// the item as a whole — a header click belongs to the SDK's own accordion
// handler (see connect-modal-row.ts's buildRowMarkup).
const launchButton = (wrapper: Element): HTMLElement | null =>
    (desktopModeRoot(wrapper)?.getElementById(LAUNCH_BUTTON_ID) ??
        null) as HTMLElement | null

describe('installConnectModalWatcher', () => {
    let dispose: (() => void) | undefined

    beforeEach(() => {
        document.body.innerHTML = ''
        delete (globalThis as { onExtensionConnect?: unknown })
            .onExtensionConnect
    })

    afterEach(() => {
        dispose?.()
        dispose = undefined
    })

    it('injects a row for a modal already present at install time', () => {
        const wrapper = appendModal()
        dispose = installConnectModalWatcher({ requestPair: vi.fn() })
        expect(injectedRow(wrapper)).not.toBeNull()
    })

    it('injects a row for a modal added after install', async () => {
        dispose = installConnectModalWatcher({ requestPair: vi.fn() })
        const wrapper = appendModal()
        await vi.waitFor(() => {
            expect(injectedRow(wrapper)).not.toBeNull()
        })
    })

    it('requests a pair with the extracted URI when the launch button is clicked', () => {
        const wrapper = appendModal()
        const requestPair = vi.fn()
        dispose = installConnectModalWatcher({ requestPair })

        launchButton(wrapper)?.click()

        expect(requestPair).toHaveBeenCalledWith(VALID_URI)
    })

    it('never requests a pair without a click', () => {
        appendModal()
        const requestPair = vi.fn()
        dispose = installConnectModalWatcher({ requestPair })
        expect(requestPair).not.toHaveBeenCalled()
    })

    it('does not inject when the page can drive ARC-0027 itself', () => {
        ;(globalThis as { onExtensionConnect?: unknown }).onExtensionConnect =
            () => {}
        const wrapper = appendModal()
        dispose = installConnectModalWatcher({ requestPair: vi.fn() })
        expect(injectedRow(wrapper)).toBeNull()
    })

    it('stops injecting after the disposer runs', async () => {
        dispose = installConnectModalWatcher({ requestPair: vi.fn() })
        dispose()
        dispose = undefined
        const wrapper = appendModal()
        // Give the observer a turn it should no longer be taking.
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(injectedRow(wrapper)).toBeNull()
    })
})
