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
    JsonRpcErrorCode,
    isJsonRpcRequest,
    jsonRpcError,
    type JsonRpcNotification,
    type JsonRpcRequest,
    type JsonRpcResponse,
} from '@perawallet/wallet-core-dapp/wire'
import { isWithinDappPayloadBounds } from '@perawallet/wallet-core-dapp/bounds'
import type {
    DappRequestContext,
    DappRespond,
    DappTransport,
} from '@perawallet/wallet-core-dapp'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { safeOrigin } from '../hooks/handlers-shared'
import { webViewScript, type WebViewScript } from './webViewScript'

/** The page-side function native calls with a JSON-RPC response or notification. */
export const EIP1193_DELIVER_GLOBAL = '__peraEip1193Deliver'

export type Eip1193PageMessage = {
    provider: 'eip1193'
    token: string
    hasUserActivation: boolean
    request: JsonRpcRequest
}

export const isEip1193PageMessage = (
    data: unknown,
): data is Eip1193PageMessage => {
    if (typeof data !== 'object' || data === null) return false
    const message = data as Record<string, unknown>
    return (
        message.provider === 'eip1193' &&
        typeof message.token === 'string' &&
        typeof message.hasUserActivation === 'boolean' &&
        isJsonRpcRequest(message.request)
    )
}

export type WebViewDappPage = {
    currentUrl: () => string
    inject: (script: WebViewScript) => void
}

export type WebViewDappTransport = DappTransport & {
    attach: (page: WebViewDappPage) => () => void
    receive: (
        page: WebViewDappPage,
        message: Eip1193PageMessage,
        sourceUrl: string,
    ) => void
}

type RequestListener = Parameters<DappTransport['onRequest']>[0]

const deliverScript = (
    message: JsonRpcResponse | JsonRpcNotification,
): WebViewScript =>
    webViewScript`var deliver = window[${EIP1193_DELIVER_GLOBAL}]; if (deliver) { deliver(${message}); }true;`

const guardedDeliverScript = (
    origin: string,
    message: JsonRpcResponse | JsonRpcNotification,
): WebViewScript =>
    webViewScript`if (location.origin === ${origin}) { var deliver = window[${EIP1193_DELIVER_GLOBAL}]; if (deliver) { deliver(${message}); } }true;`

// Only https pages are served: the origin is also the connection's identity,
// so a plaintext page must not be able to hold or reuse a site's grant.
const httpsOriginOf = (url: string): Nullable<string> => {
    const origin = safeOrigin(url)
    return origin?.startsWith('https://') ? origin : null
}

export const createWebViewDappTransport = (): WebViewDappTransport => {
    const pages = new Set<WebViewDappPage>()
    let listener: Nullable<RequestListener> = null

    const attach = (page: WebViewDappPage): (() => void) => {
        pages.add(page)
        return () => {
            pages.delete(page)
        }
    }

    const refuse = (
        page: WebViewDappPage,
        request: JsonRpcRequest,
        code: number,
        message: string,
    ): void => {
        page.inject(deliverScript(jsonRpcError(request.id, code, message)))
    }

    const receive: WebViewDappTransport['receive'] = (
        page,
        message,
        sourceUrl,
    ) => {
        const { request } = message
        const origin = httpsOriginOf(sourceUrl)
        if (!origin) {
            refuse(
                page,
                request,
                EIP1193_ERROR_CODE.unauthorized,
                'Pera serves only secure pages',
            )
            return
        }
        if (!isWithinDappPayloadBounds(request)) {
            refuse(
                page,
                request,
                JsonRpcErrorCode.InvalidParams,
                'The request is too large',
            )
            return
        }
        if (!listener) {
            refuse(
                page,
                request,
                EIP1193_ERROR_CODE.disconnected,
                'The wallet is not ready',
            )
            return
        }
        const ctx: DappRequestContext = {
            origin,
            hasUserActivation: message.hasUserActivation,
        }
        // The handler logs a rejection; an answer for a page that has
        // navigated away is dropped here rather than injected.
        const respond: DappRespond = async response => {
            if (
                !pages.has(page) ||
                httpsOriginOf(page.currentUrl()) !== origin
            ) {
                throw new Error('The page is no longer on this origin')
            }
            page.inject(guardedDeliverScript(origin, response))
        }
        listener(ctx, request, respond)
    }

    return {
        attach,
        receive,
        onRequest: next => {
            listener = next
            return () => {
                if (listener === next) listener = null
            }
        },
        notify: async (origin, notification) => {
            for (const page of pages) {
                if (httpsOriginOf(page.currentUrl()) !== origin) continue
                try {
                    page.inject(guardedDeliverScript(origin, notification))
                } catch (error) {
                    logger.warn('[eip1193] notification never reached a page', {
                        error,
                    })
                }
            }
        },
    }
}

export const webViewDappTransport = createWebViewDappTransport()
