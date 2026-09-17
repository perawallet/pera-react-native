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

// Pure wire for the window.pera transport: scopes, message shapes, guards.
// No chrome.* usage — content scripts pull this in through content-wire.ts.
import {
    isJsonRpcNotification,
    isJsonRpcRequest,
    isJsonRpcResponse,
    type JsonRpcNotification,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from '@perawallet/wallet-core-dapp/wire'

/** Content relay → service worker. Sender is a content script; origin comes from `sender.origin`. */
export const DAPP_PAGE_REQUEST_SCOPE = 'pera-dapp-page-request' as const
/** Service worker → content relay, via `chrome.tabs.sendMessage`. */
export const DAPP_PAGE_RESPONSE_SCOPE = 'pera-dapp-page-response' as const
/** Service worker → offscreen host, origin already verified and stamped. */
export const DAPP_HOST_REQUEST_SCOPE = 'pera-dapp-host-request' as const
/** Offscreen host → service worker, to be delivered to a tab (or every tab of the origin). */
export const DAPP_HOST_RESPONSE_SCOPE = 'pera-dapp-host-response' as const

export type DappReturnAddress = { tabId: number }
export type DappPagePayload = JsonRpcResponse | JsonRpcNotification

export type DappPageRequestMessage = {
    scope: typeof DAPP_PAGE_REQUEST_SCOPE
    request: JsonRpcRequest
    /** `navigator.userActivation.isActive` as read by the ISOLATED relay; the page cannot forge that world's view. */
    hasUserActivation: boolean
}
export type DappPageRequestAck =
    | { ok: true }
    | { ok: false; response: JsonRpcResponse }
export type DappPageResponseMessage = {
    scope: typeof DAPP_PAGE_RESPONSE_SCOPE
    origin: string
    payload: DappPagePayload
}
export type DappHostRequestMessage = {
    scope: typeof DAPP_HOST_REQUEST_SCOPE
    origin: string
    hasUserActivation: boolean
    faviconUrl?: string
    returnTo: DappReturnAddress
    request: JsonRpcRequest
}
export type DappHostResponseMessage = {
    scope: typeof DAPP_HOST_RESPONSE_SCOPE
    origin: string
    payload: DappPagePayload
    /** Absent for a notification, which goes to every tab of `origin`. */
    returnTo?: DappReturnAddress
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null
const isReturnAddress = (value: unknown): value is DappReturnAddress =>
    isRecord(value) && typeof value.tabId === 'number'
const isPagePayload = (value: unknown): value is DappPagePayload =>
    isJsonRpcResponse(value) || isJsonRpcNotification(value)

export const isDappPageRequestMessage = (
    value: unknown,
): value is DappPageRequestMessage =>
    isRecord(value) &&
    value.scope === DAPP_PAGE_REQUEST_SCOPE &&
    isJsonRpcRequest(value.request) &&
    typeof value.hasUserActivation === 'boolean'

export const isDappPageRequestAck = (
    value: unknown,
): value is DappPageRequestAck =>
    isRecord(value) &&
    (value.ok === true ||
        (value.ok === false && isJsonRpcResponse(value.response)))

/** Delivery receipt shared by every chrome.runtime hop in this transport. */
export const isDappAck = (value: unknown): boolean =>
    typeof value === 'object' &&
    value !== null &&
    (value as { ok?: unknown }).ok === true

export const isDappPageResponseMessage = (
    value: unknown,
): value is DappPageResponseMessage =>
    isRecord(value) &&
    value.scope === DAPP_PAGE_RESPONSE_SCOPE &&
    typeof value.origin === 'string' &&
    isPagePayload(value.payload)

export const isDappHostRequestMessage = (
    value: unknown,
): value is DappHostRequestMessage =>
    isRecord(value) &&
    value.scope === DAPP_HOST_REQUEST_SCOPE &&
    typeof value.origin === 'string' &&
    typeof value.hasUserActivation === 'boolean' &&
    (value.faviconUrl === undefined || typeof value.faviconUrl === 'string') &&
    isReturnAddress(value.returnTo) &&
    isJsonRpcRequest(value.request)

export const isDappHostResponseMessage = (
    value: unknown,
): value is DappHostResponseMessage =>
    isRecord(value) &&
    value.scope === DAPP_HOST_RESPONSE_SCOPE &&
    typeof value.origin === 'string' &&
    isPagePayload(value.payload) &&
    (value.returnTo === undefined || isReturnAddress(value.returnTo))
