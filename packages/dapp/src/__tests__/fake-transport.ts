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

import type {
    JsonRpcNotification,
    JsonRpcRequest,
    JsonRpcResponse,
} from '../codec'
import type { DappRequestContext, DappRespond, DappTransport } from '../models'

type Listener = (
    ctx: DappRequestContext,
    request: JsonRpcRequest,
    respond: DappRespond,
) => void

/** Drives the handler like a page would; `send` resolves with the first response delivered for the request. */
export class FakeDappTransport implements DappTransport {
    listener: Listener | undefined
    readonly notifications: Array<{
        origin: string
        notification: JsonRpcNotification
    }> = []
    private readonly unreachable = new Set<string>()
    private seq = 0

    onRequest(listener: Listener): () => void {
        this.listener = listener
        return () => {
            this.listener = undefined
        }
    }

    async notify(
        origin: string,
        notification: JsonRpcNotification,
    ): Promise<void> {
        this.notifications.push({ origin, notification })
    }

    setReachable(origin: string, isReachable: boolean): void {
        if (isReachable) this.unreachable.delete(origin)
        else this.unreachable.add(origin)
    }

    send(
        origin: string,
        method: string,
        params?: unknown,
        opts: {
            hasUserActivation?: boolean
            faviconUrl?: string
            id?: string
        } = {},
    ): Promise<JsonRpcResponse> {
        if (!this.listener) throw new Error('handler is not listening')
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: opts.id ?? `req-${++this.seq}`,
            method,
            ...(params === undefined ? {} : { params }),
        }
        return new Promise<JsonRpcResponse>(resolve => {
            let delivered = false
            const respond: DappRespond = async response => {
                if (this.unreachable.has(origin)) {
                    throw new Error(`page at ${origin} is unreachable`)
                }
                if (!delivered) {
                    delivered = true
                    resolve(response)
                }
            }
            this.listener!(
                {
                    origin,
                    hasUserActivation: opts.hasUserActivation ?? true,
                    ...(opts.faviconUrl ? { faviconUrl: opts.faviconUrl } : {}),
                },
                request,
                respond,
            )
        })
    }
}
