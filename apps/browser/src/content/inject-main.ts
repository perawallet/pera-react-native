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
    DAPP_PROVIDER_VERSION,
    dappPageTimeoutMs,
    EIP1193_ERROR_CODE,
    JsonRpcErrorCode,
    isJsonRpcNotification,
    isJsonRpcResponse,
    type DappMethod,
    type DappProvider,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from '@perawallet/wallet-core-browser-runtime'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type ConnectModalPairDetail,
    type DappBridgeNotificationEnvelope,
    type DappBridgeRequestEnvelope,
    type DappBridgeResponseEnvelope,
} from './channel'
import { installConnectModalWatcher } from './connect-modal-watcher'
import {
    Eip1193ProviderError,
    createEip1193Provider,
    installEip1193Provider,
} from './eip1193-main'

// MAIN-world providers. No chrome.* here. Installs window.pera and the EIP-1193
// provider, and bridges each call to the isolated relay over
// per-load-randomized CustomEvents; answers and wallet-initiated notifications
// come back on the response channel, tagged with the provider they belong to.

export type PeraAccount = { address: string; name: string }
export type PeraConnectOptions = {
    name?: string
    description?: string
    icons?: string[]
    network?: string
}
/** Address to base64 empty signature; see {@link PeraConnectResult}. */
export type PeraEmptySignatures = Record<string, string>
export type PeraConnectResult = {
    accounts: PeraAccount[]
    network: string
    /**
     * Address to base64 msgpack `SignedTransaction` minus `txn`, per use-wallet's
     * empty-signature spec. An address left out is of unknown account type.
     */
    emptySignatures: PeraEmptySignatures
}
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
    /** `network` is refused unless it is the wallet's current one. */
    getEmptySignatures(options?: {
        network?: string
    }): Promise<PeraEmptySignatures>
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
    toError: ToError
    timer: ReturnType<typeof setTimeout>
}
type ToError = (code: number, message: string, data?: unknown) => Error
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
            entry.toError(
                response.error.code,
                response.error.message,
                response.error.data,
            ),
        )
    } else {
        entry.resolve(response.result)
    }
}

const TIMEOUT_CODE: Record<DappProvider, number> = {
    pera: JsonRpcErrorCode.RequestTimedOut,
    eip1193: EIP1193_ERROR_CODE.internal,
}

const sendRpc = (
    provider: DappProvider,
    method: string,
    params: unknown,
    toError: ToError,
): Promise<unknown> =>
    new Promise((resolve, reject) => {
        const id = globalThis.crypto.randomUUID()
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            ...(params === undefined ? {} : { params }),
        }
        // Backstop only; the wallet's own expiry is shorter and answers first.
        const timer = setTimeout(
            () => {
                if (!pending.delete(id)) return
                reject(
                    toError(TIMEOUT_CODE[provider], 'No response from wallet'),
                )
            },
            dappPageTimeoutMs(provider, method),
        )
        pending.set(id, { resolve, reject, toError, timer })
        window.dispatchEvent(
            new CustomEvent(requestEventName, {
                detail: {
                    id,
                    provider,
                    request,
                } satisfies DappBridgeRequestEnvelope,
            }),
        )
    })

const toPeraError: ToError = (code, message, data) =>
    new PeraProviderError(code, message, data)

const send = (method: DappMethod, params?: unknown): Promise<unknown> =>
    sendRpc('pera', method, params, toPeraError)

// Written with the baked flag inline so esbuild folds it away entirely in a
// build that serves no EVM chain.
const eip1193 = __PERA_SERVES_EVM__
    ? createEip1193Provider((method, params) =>
          sendRpc(
              'eip1193',
              method,
              params,
              (code, message, data) =>
                  new Eip1193ProviderError(code, message, data),
          ),
      )
    : null

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
    getEmptySignatures: options =>
        send(
            'getEmptySignatures',
            options ?? {},
        ) as Promise<PeraEmptySignatures>,
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
            | DappBridgeResponseEnvelope
            | DappBridgeNotificationEnvelope
        if ('notification' in detail) {
            const { notification, provider } = detail
            if (!isJsonRpcNotification(notification)) return
            if (provider === 'eip1193') {
                eip1193?.handleNotification(notification)
                return
            }
            if (provider !== 'pera') return
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

    if (__PERA_SERVES_EVM__ && eip1193) installEip1193Provider(eip1193.provider)

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
