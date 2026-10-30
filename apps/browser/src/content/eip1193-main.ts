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
    EIP1193_ERROR_CODE,
    EIP1193_EVENT,
    EIP1193_METHOD,
    type Eip1193Event,
    type JsonRpcNotification,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    PERA_EIP6963_ICON,
    PERA_EIP6963_NAME,
    PERA_EIP6963_RDNS,
} from './eip6963'

// MAIN-world EIP-1193 provider. No chrome.* here: requests go out through the
// same bridge as window.pera, tagged as this provider.

export type Eip1193RequestArguments = { method: string; params?: unknown }

export class Eip1193ProviderError extends Error {
    readonly code: number
    readonly data?: unknown
    constructor(code: number, message: string, data?: unknown) {
        super(message)
        this.name = 'Eip1193ProviderError'
        this.code = code
        this.data = data
    }
}

type Listener = (payload: unknown) => void

export type PeraEip1193Provider = {
    readonly isPera: true
    request(args: Eip1193RequestArguments): Promise<unknown>
    on(event: Eip1193Event, listener: Listener): PeraEip1193Provider
    removeListener(event: Eip1193Event, listener: Listener): PeraEip1193Provider
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string')

const isSameList = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((item, index) => item === b[index])

const ANNOUNCE_EVENT = 'eip6963:announceProvider'
const REQUEST_EVENT = 'eip6963:requestProvider'

export const createEip1193Provider = (
    send: (method: string, params?: unknown) => Promise<unknown>,
): {
    provider: PeraEip1193Provider
    handleNotification: (notification: JsonRpcNotification) => void
} => {
    const listeners = new Map<Eip1193Event, Set<Listener>>()
    let accounts: string[] = []
    let chainId: Nullable<string> = null
    let hasAnnouncedConnect = false

    const emit = (event: Eip1193Event, payload: unknown): void => {
        listeners.get(event)?.forEach(listener => {
            try {
                listener(payload)
            } catch {
                // A page listener's throw must not break delivery to the others.
            }
        })
    }

    const setAccounts = (next: unknown): void => {
        if (!isStringList(next) || isSameList(accounts, next)) return
        accounts = [...next]
        emit(EIP1193_EVENT.accountsChanged, [...next])
    }

    // A notification always reports a move; an answer only once a chain was
    // already known, so the first eth_chainId reads as `connect` instead.
    const setChainId = (next: unknown, isNotification: boolean): void => {
        if (typeof next !== 'string' || next === chainId) return
        const previous = chainId
        chainId = next
        if (isNotification || previous !== null) {
            emit(EIP1193_EVENT.chainChanged, next)
        }
    }

    const announceConnect = (result: unknown): void => {
        if (hasAnnouncedConnect || typeof result !== 'string') return
        hasAnnouncedConnect = true
        emit(EIP1193_EVENT.connect, { chainId: result })
    }

    // React StrictMode and wagmi's reconnect both double-fire this; the wallet
    // would refuse the second as already pending.
    let requestAccountsInFlight: Nullable<Promise<unknown>> = null

    const request = (args: Eip1193RequestArguments): Promise<unknown> => {
        if (!isRecord(args) || typeof args.method !== 'string') {
            return Promise.reject(
                new Eip1193ProviderError(
                    EIP1193_ERROR_CODE.invalidParams,
                    'Expected { method, params? }',
                ),
            )
        }
        const { method, params } = args
        if (method === EIP1193_METHOD.requestAccounts) {
            if (requestAccountsInFlight) return requestAccountsInFlight
            const inFlight = send(method, params).then(result => {
                setAccounts(result)
                return result
            })
            requestAccountsInFlight = inFlight
            const release = () => {
                if (requestAccountsInFlight === inFlight) {
                    requestAccountsInFlight = null
                }
            }
            inFlight.then(release, release)
            return inFlight
        }
        return send(method, params).then(result => {
            if (method === EIP1193_METHOD.accounts) setAccounts(result)
            if (method === EIP1193_METHOD.chainId) {
                setChainId(result, false)
                announceConnect(result)
            }
            return result
        })
    }

    // Not frozen: dApps written against MetaMask set flags on it at startup
    // (`autoRefreshOnNetworkChange`), which throws on a frozen object.
    const provider: PeraEip1193Provider = {
        isPera: true as const,
        request,
        on: (event: Eip1193Event, listener: Listener) => {
            const set = listeners.get(event) ?? new Set()
            set.add(listener)
            listeners.set(event, set)
            return provider
        },
        removeListener: (event: Eip1193Event, listener: Listener) => {
            listeners.get(event)?.delete(listener)
            return provider
        },
    }

    const handleNotification = (notification: JsonRpcNotification): void => {
        if (notification.method === EIP1193_EVENT.accountsChanged) {
            setAccounts(notification.params)
        } else if (notification.method === EIP1193_EVENT.chainChanged) {
            setChainId(notification.params, true)
        }
    }

    return { provider, handleNotification }
}

let installed = false

/**
 * Takes `window.ethereum` only while it is free, and leaves it replaceable,
 * so a wallet injecting later still wins it. EIP-6963 lists Pera regardless.
 */
export const installEip1193Provider = (provider: PeraEip1193Provider): void => {
    if (installed) return
    installed = true

    if (!('ethereum' in window)) {
        try {
            Object.defineProperty(window, 'ethereum', {
                value: provider,
                writable: true,
                configurable: true,
                enumerable: true,
            })
        } catch {
            // Claimed in between by a non-configurable define; theirs stands.
        }
    }

    const detail = Object.freeze({
        info: Object.freeze({
            uuid: globalThis.crypto.randomUUID(),
            name: PERA_EIP6963_NAME,
            icon: PERA_EIP6963_ICON,
            rdns: PERA_EIP6963_RDNS,
        }),
        provider,
    })
    const announce = (): void => {
        window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail }))
    }
    window.addEventListener(REQUEST_EVENT, announce)
    announce()
}
