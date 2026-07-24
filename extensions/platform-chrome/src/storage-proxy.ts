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

// Offscreen documents expose ONLY chrome.runtime — chrome.storage is not
// available there (developer.chrome.com/docs/extensions/reference/api/offscreen).
// But the offscreen surface needs the same KV state as every other context:
// zustand persist reads accounts/network/polling through
// ChromeKeyValueStorageService, which is backed by chrome.storage.local. So
// the service worker (full API access) proxies storage over runtime
// messaging: startStorageProxyHost() serves get/set/remove and relays
// onChanged broadcasts; installOffscreenStorageShim() installs a promise-only
// chrome.storage.local lookalike backed by that host. Only the `local` area
// and the ops the offscreen boot path uses are proxied — vault/session code
// never runs in the offscreen document.

import { isTrustedExtensionPageSender } from './trusted-sender'

export const STORAGE_PROXY_SCOPE = 'pera-storage-proxy'
export const STORAGE_EVENT_SCOPE = 'pera-storage-event'

type StorageProxyPayload =
    | { kind: 'get'; keys: null | string | string[] }
    | { kind: 'set'; items: Record<string, unknown> }
    | { kind: 'remove'; keys: string | string[] }

export type StorageProxyMessage = StorageProxyPayload & {
    scope: typeof STORAGE_PROXY_SCOPE
}

export type StorageProxyResponse =
    | { ok: true; result?: Record<string, unknown> }
    | { ok: false; error: string }

type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>

export type StorageChangedBroadcast = {
    scope: typeof STORAGE_EVENT_SCOPE
    changes: StorageChanges
    areaName: string
}

type ChangeListener = (changes: StorageChanges, areaName: string) => void

/**
 * Service-worker side: answers storage proxy messages against the real
 * chrome.storage.local and relays every onChanged event to the offscreen
 * document. Must be registered at the SW's top level so message delivery
 * wakes a sleeping worker with the listener already in place.
 */
export const startStorageProxyHost = (
    chromeLike: typeof chrome = chrome,
): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            const msg = message as StorageProxyMessage | undefined
            if (msg?.scope !== STORAGE_PROXY_SCOPE) return undefined
            // The storage proxy has exactly one legitimate client: the
            // offscreen document (the only context without native
            // chrome.storage). Content scripts will eventually share this
            // onMessage listener with every extension page — refuse anyone
            // else before touching chrome.storage.local on their behalf.
            if (
                !isTrustedExtensionPageSender(sender, chromeLike) ||
                sender?.url !== chromeLike.runtime.getURL('offscreen.html')
            ) {
                const refusal: StorageProxyResponse = {
                    ok: false,
                    error: 'untrusted sender',
                }
                sendResponse(refusal)
                return undefined
            }
            const respond = async (): Promise<StorageProxyResponse> => {
                try {
                    if (msg.kind === 'get') {
                        // Split call: @types/chrome's get() overloads reject
                        // the combined `null | string | string[]` union.
                        const result =
                            msg.keys === null
                                ? await chromeLike.storage.local.get(null)
                                : await chromeLike.storage.local.get(msg.keys)
                        return { ok: true, result }
                    }
                    if (msg.kind === 'set') {
                        await chromeLike.storage.local.set(msg.items)
                        return { ok: true }
                    }
                    await chromeLike.storage.local.remove(msg.keys)
                    return { ok: true }
                } catch (error) {
                    return {
                        ok: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }
                }
            }
            void respond().then(sendResponse)
            return true // async sendResponse
        },
    )
    chromeLike.storage.onChanged.addListener((changes, areaName) => {
        // NEVER relay non-local areas: chrome.storage.session holds the raw
        // vault master key; broadcasting its change events would push key
        // material over runtime messaging (defeats TRUSTED_CONTEXTS).
        if (areaName !== 'local') return
        const broadcast: StorageChangedBroadcast = {
            scope: STORAGE_EVENT_SCOPE,
            changes: changes as StorageChanges,
            areaName,
        }
        // No receiver (offscreen not yet created / already closed) is normal.
        chromeLike.runtime.sendMessage(broadcast).catch(() => undefined)
    })
}

/**
 * Offscreen-document side: installs a chrome.storage lookalike (promise-only
 * `local` area + `onChanged`) proxied through the service worker. No-op when
 * chrome.storage already exists (every non-offscreen context). MUST run
 * before anything reads chrome.storage — the web bootstrap installs it before
 * hydratePlatform()/hydrateKeystoreStorage().
 */
export const installOffscreenStorageShim = (
    chromeLike: typeof chrome = chrome,
): void => {
    if (chromeLike.storage !== undefined) return

    const call = async (
        message: StorageProxyPayload,
    ): Promise<Record<string, unknown>> => {
        const response = (await chromeLike.runtime.sendMessage({
            scope: STORAGE_PROXY_SCOPE,
            ...message,
        })) as StorageProxyResponse | undefined
        if (!response?.ok) {
            throw new Error(
                `storage proxy ${message.kind} failed: ${
                    response?.error ?? 'no response from service worker'
                }`,
            )
        }
        return response.result ?? {}
    }

    const listeners = new Set<ChangeListener>()
    chromeLike.runtime.onMessage.addListener((message: unknown, sender) => {
        const msg = message as StorageChangedBroadcast | undefined
        if (msg?.scope !== STORAGE_EVENT_SCOPE) return undefined
        if (!isTrustedExtensionPageSender(sender, chromeLike)) return undefined
        listeners.forEach(listener => listener(msg.changes, msg.areaName))
        return undefined
    })

    const shim = {
        local: {
            get: (keys: null | string | string[]) =>
                call({ kind: 'get', keys }),
            set: async (items: Record<string, unknown>): Promise<void> => {
                await call({ kind: 'set', items })
            },
            remove: async (keys: string | string[]): Promise<void> => {
                await call({ kind: 'remove', keys })
            },
        },
        onChanged: {
            addListener: (listener: ChangeListener): void => {
                listeners.add(listener)
            },
            removeListener: (listener: ChangeListener): void => {
                listeners.delete(listener)
            },
        },
    }
    // Poison pill: chrome.storage.session (the raw vault master key's home)
    // is deliberately NOT proxied. Any offscreen code path that reaches for
    // it is a bug — fail loud instead of silently returning undefined.
    Object.defineProperty(shim, 'session', {
        enumerable: true,
        get(): never {
            throw new Error(
                'chrome.storage.session is not available in offscreen documents and is deliberately not proxied',
            )
        },
    })
    ;(chromeLike as { storage?: unknown }).storage = shim
}
