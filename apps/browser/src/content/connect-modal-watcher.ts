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

import { CONNECT_MODAL_WRAPPER_ID } from './connect-modal-uri'
import { injectExtensionRow } from './connect-modal-row'

/**
 * Watches for a @perawallet/connect connect-modal and offers the extension as
 * a connection option when the dApp's own SDK cannot.
 *
 * Deliberately far less aggressive than the Discover-iframe bridge
 * (discover-main.ts) and native's peraConnectJS, which remove the modal and
 * auto-pair: here the modal is left completely intact and nothing happens
 * until the user clicks the injected row. QR, mobile and Pera Web all keep
 * working.
 */
export const installConnectModalWatcher = ({
    requestPair,
}: {
    requestPair: (uri: string) => void
}): (() => void) => {
    const process = (): void => {
        const wrapper = document.getElementById(CONNECT_MODAL_WRAPPER_ID)
        if (!wrapper) return
        // injectExtensionRow is idempotent and makes its own decision about
        // whether this modal qualifies, so re-entrant observer callbacks (our
        // own injection mutates the observed tree) are safe.
        injectExtensionRow(wrapper, requestPair)
    }

    let observer: MutationObserver | null = null
    const attach = (): void => {
        try {
            observer = new MutationObserver(process)
            observer.observe(document.body, { childList: true, subtree: true })
        } catch {
            // document.body absent/inaccessible — nothing to observe.
        }
        // Run once in case the modal was inserted before we attached.
        process()
    }

    if (document.body) {
        attach()
    } else {
        window.addEventListener('DOMContentLoaded', attach, { once: true })
    }

    return () => {
        observer?.disconnect()
        observer = null
    }
}
