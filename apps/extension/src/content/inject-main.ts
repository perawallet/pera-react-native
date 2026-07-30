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

import {
    ARC0027_ERROR_CODES,
    buildErrorResponse,
    isArc0027Request,
    type Arc0027ResponseEnvelope,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
    type ConnectModalPairDetail,
} from './channel'
import { installConnectModalWatcher } from './connect-modal-watcher'

// MAIN-world provider. No chrome.* here. Bridges dapp window.postMessage ARC-0027
// requests to the isolated relay over per-load-randomized CustomEvents, and posts
// responses back to the page with window.postMessage.
const rand = () => globalThis.crypto.randomUUID().replace(/-/g, '')
const requestEventName = `__pera_req_${rand()}__`
const responseEventName = `__pera_res_${rand()}__`

let channelSeq = 0
let installed = false
const pending = new Map<string, (response: Arc0027ResponseEnvelope) => void>()

// Test-only introspection of the per-load channel names: production code never
// reads these statics, it closes over requestEventName/responseEventName above.
// jsdom tests can't observe the private closure, so we hang read-only copies
// off the exported function for `installMainProvider.__requestEventName` etc.
type MainProviderInstaller = (() => void) & {
    __requestEventName: string
    __responseEventName: string
}

// Dispatches (or re-dispatches) the handshake with this load's fixed channel
// names. Safe to call more than once: the names never change after module
// init, and the relay's first-only guard makes repeat handshakes idempotent.
const dispatchHandshake = (): void => {
    window.dispatchEvent(
        new CustomEvent(CHANNEL_HANDSHAKE_EVENT, {
            detail: { requestEventName, responseEventName },
        }),
    )
}

const installProvider = (): void => {
    // Idempotent: guards against double-listener registration if the script
    // runs more than once in this world (e.g. re-injection) or is invoked
    // again explicitly (as tests do to obtain a fresh, deterministic setup).
    if (installed) return
    installed = true

    // Hand the isolated relay our private channel names. The manifest's
    // script-execution order across worlds is not a hard guarantee, so this
    // initial dispatch can be lost if the relay hasn't registered its
    // handshake listener yet (a CustomEvent with no listener is simply
    // dropped, there's no queuing). The CHANNEL_RELAY_READY_EVENT listener
    // below covers that case by re-dispatching once the relay signals it's
    // listening — covering both load orders without needing a real ack/retry
    // protocol.
    dispatchHandshake()

    // Re-send the same channel names if the relay registers after this
    // dispatch, so it isn't stuck with a dropped handshake.
    //
    // Forging this event gains a page nothing: it can only trigger a redundant
    // re-dispatch of our own fixed names, never alter them. Page code can
    // already observe those names anyway — they're not a trust boundary, since
    // authorization is enforced at the SW via `sender.origin`.
    window.addEventListener(CHANNEL_RELAY_READY_EVENT, dispatchHandshake)

    window.addEventListener(responseEventName, (e: Event) => {
        const { id, response } = (e as CustomEvent)
            .detail as BridgeResponseEnvelope<Arc0027ResponseEnvelope>
        const resolve = pending.get(id)
        if (!resolve) return
        pending.delete(id)
        resolve(response)
    })

    window.addEventListener('message', (event: MessageEvent) => {
        // Only same-window page messages. A co-embedded iframe can post a
        // message and then remove itself, in which case real Chrome delivers
        // the event with `event.source === null` — that must still be
        // rejected, so this check stays strict (no null allowance).
        if (event.source !== window) return
        const request = event.data
        if (!isArc0027Request(request)) return

        const channelId = `${channelSeq++}`
        const forward = (response: Arc0027ResponseEnvelope) =>
            window.postMessage(
                response,
                window.origin === 'null' ? '*' : window.origin,
            )

        pending.set(channelId, forward)
        // Safety timeout so a dead relay never leaks a pending entry.
        setTimeout(() => {
            if (!pending.delete(channelId)) return
            forward(
                buildErrorResponse(request, {
                    code: ARC0027_ERROR_CODES.MethodTimedOutError,
                    message: 'No response from wallet',
                }),
            )
        }, 120_000)

        window.dispatchEvent(
            new CustomEvent(requestEventName, {
                detail: {
                    id: channelId,
                    request,
                } satisfies BridgeRequestEnvelope,
            }),
        )
    })

    // Connect-modal hook: offers the extension in a dApp's own QR modal when
    // the dApp's SDK has no extension transport. MAIN world is required —
    // window.onExtensionConnect is a page global an ISOLATED script cannot see.
    installConnectModalWatcher({
        requestPair: uri => {
            window.dispatchEvent(
                new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                    detail: { uri } satisfies ConnectModalPairDetail,
                }),
            )
        },
    })
}

export const installMainProvider = installProvider as MainProviderInstaller
installMainProvider.__requestEventName = requestEventName
installMainProvider.__responseEventName = responseEventName

installMainProvider()
