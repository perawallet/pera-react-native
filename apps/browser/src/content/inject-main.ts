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
    type DAPP_NOTIFICATIONS,
    DAPP_PAGE_TIMEOUT_MS,
    DAPP_PROVIDER_VERSION,
    JsonRpcErrorCode,
    isJsonRpcNotification,
    isJsonRpcResponse,
    type DappMethod,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type BridgeNotificationEnvelope,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
    type ConnectModalPairDetail,
} from './channel'
import { installConnectModalWatcher } from './connect-modal-watcher'

// MAIN-world provider. No chrome.* here. Installs window.pera and bridges each
// call to the isolated relay over per-load-randomized CustomEvents; answers and
// wallet-initiated notifications come back on the response channel.

export type PeraAccount = { address: string; name: string }
export type PeraConnectOptions = {
    name?: string
    description?: string
    icons?: string[]
    network?: string
}
export type PeraConnectResult = { accounts: PeraAccount[]; network: string }
export type PeraEvent = keyof typeof DAPP_NOTIFICATIONS
export type PeraSignTransactionsItem = {
    txn: string
    signers?: string[]
    authAddr?: string
    msig?: unknown
    stxn?: string
    message?: string
}
export type PeraProvider = {
    readonly version: typeof DAPP_PROVIDER_VERSION
    connect(options?: PeraConnectOptions): Promise<PeraConnectResult>
    disconnect(): Promise<void>
    getAddresses(): Promise<PeraAccount[]>
    signTransactions(
        txns: PeraSignTransactionsItem[],
        opts?: { message?: string },
    ): Promise<(string | null)[]>
    signData(payload: unknown): Promise<string[]>
    on(event: PeraEvent, handler: (params: unknown) => void): () => void
}

declare global {
    interface Window {
        pera: PeraProvider
    }
}

export class PeraProviderError extends Error {
    readonly code: number
    readonly data?: unknown
    constructor(code: number, message: string, data?: unknown) {
        super(message)
        this.name = 'PeraProviderError'
        this.code = code
        this.data = data
    }
}

const rand = () => globalThis.crypto.randomUUID().replace(/-/g, '')
const requestEventName = `__pera_req_${rand()}__`
const responseEventName = `__pera_res_${rand()}__`

let installed = false
type Pending = {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}
const pending = new Map<string, Pending>()
const listeners = new Map<string, Set<(params: unknown) => void>>()

// Test-only introspection of the per-load channel names: production code never
// reads these statics, it closes over requestEventName/responseEventName above.
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

const settle = (response: JsonRpcResponse): void => {
    const entry = pending.get(String(response.id))
    if (!entry) return
    pending.delete(String(response.id))
    clearTimeout(entry.timer)
    if ('error' in response) {
        entry.reject(
            new PeraProviderError(
                response.error.code,
                response.error.message,
                response.error.data,
            ),
        )
    } else {
        entry.resolve(response.result)
    }
}

const send = (method: DappMethod, params?: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
        const id = globalThis.crypto.randomUUID()
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            ...(params === undefined ? {} : { params }),
        }
        // Backstop only; the wallet's own expiry is shorter and answers first.
        const timer = setTimeout(() => {
            if (!pending.delete(id)) return
            reject(
                new PeraProviderError(
                    JsonRpcErrorCode.RequestTimedOut,
                    'No response from wallet',
                ),
            )
        }, DAPP_PAGE_TIMEOUT_MS)
        pending.set(id, { resolve, reject, timer })
        window.dispatchEvent(
            new CustomEvent(requestEventName, {
                detail: {
                    id,
                    request,
                } satisfies BridgeRequestEnvelope<JsonRpcRequest>,
            }),
        )
    })

// The wallet claims a per-origin connect slot synchronously, so a second
// concurrent connect() would be refused with InvalidRequest — including when
// the origin is already connected. React StrictMode's double-invoke makes that
// a routine call pattern, so share one in-flight promise instead.
let connectInFlight: Promise<PeraConnectResult> | null = null

const connect = (options?: PeraConnectOptions): Promise<PeraConnectResult> => {
    if (connectInFlight) return connectInFlight
    const inFlight = send(
        'connect',
        options ?? {},
    ) as Promise<PeraConnectResult>
    connectInFlight = inFlight
    const release = () => {
        if (connectInFlight === inFlight) connectInFlight = null
    }
    inFlight.then(release, release)
    return inFlight
}

const provider: PeraProvider = Object.freeze({
    version: DAPP_PROVIDER_VERSION,
    connect,
    disconnect: () => send('disconnect').then(() => undefined),
    getAddresses: () => send('getAddresses') as Promise<PeraAccount[]>,
    signTransactions: (txns, opts) =>
        send(
            'requestTransactionSigning',
            opts === undefined ? { txns } : { txns, opts },
        ) as Promise<(string | null)[]>,
    signData: payload =>
        send('requestDataSigning', payload) as Promise<string[]>,
    on: (event, handler) => {
        const set = listeners.get(event) ?? new Set()
        set.add(handler)
        listeners.set(event, set)
        return () => {
            set.delete(handler)
        }
    },
})

const installProvider = (): void => {
    // Idempotent: guards against double-listener registration if the script
    // runs more than once in this world (e.g. re-injection) or is invoked
    // again explicitly (as tests do to obtain a fresh, deterministic setup).
    if (installed) return
    installed = true

    // The relay may register its handshake listener after this dispatch (script
    // order across worlds is not guaranteed); it signals ready and we re-send.
    dispatchHandshake()

    // Forging the ready event gains a page nothing: it can only trigger a
    // redundant re-dispatch of our own fixed names, never alter them, and the
    // relay's first-only guard still blocks a rebind.
    window.addEventListener(CHANNEL_RELAY_READY_EVENT, dispatchHandshake)

    window.addEventListener(responseEventName, (e: Event) => {
        const detail = (e as CustomEvent).detail as
            | BridgeResponseEnvelope<unknown>
            | BridgeNotificationEnvelope<unknown>
        if ('notification' in detail) {
            const { notification } = detail
            if (!isJsonRpcNotification(notification)) return
            listeners.get(notification.method)?.forEach(handler => {
                try {
                    handler(notification.params)
                } catch {
                    // A page listener's throw must not break delivery to the others.
                }
            })
            return
        }
        if (isJsonRpcResponse(detail.response)) settle(detail.response)
    })

    try {
        Object.defineProperty(window, 'pera', {
            value: provider,
            writable: false,
            configurable: false,
            enumerable: true,
        })
    } catch {
        // Another extension got here first with a non-configurable window.pera.
        // Its provider wins; ours must still install the connect-modal hook
        // below rather than throwing out of the installer.
    }

    // Connect-modal hook: offers the extension in a dApp's own QR modal when
    // the dApp's SDK renders no extension row of its own.
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
