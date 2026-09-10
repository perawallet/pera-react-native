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

import { isPromiseLike } from '@perawallet/wallet-core-shared'

import { DB_CONTROL_SCOPE } from '../database/protocol'
import { isTrustedExtensionPageSender } from '../trusted-sender'

import {
    CONNECTIONS_CONTROL_SCOPE,
    CONNECTIONS_EVENT_SCOPE,
    CONNECTIONS_REQUEST_SCOPE,
    isConnectionsAck,
    isConnectionsControlMessage,
    isConnectionsControlResponse,
    isConnectionsEventMessage,
    type ConnectionApprovalRequest,
    type ConnectionsControlMessage,
    type ConnectionsControlResponse,
    type ConnectionsControlResult,
    type ConnectionsEvent,
} from './protocol'

// Only the service worker can call `chrome.offscreen`, so a UI realm asks it to.
// Best-effort: the control message that follows reports the real outcome.
const ensureOffscreenHost = async (): Promise<void> => {
    try {
        await chrome.runtime.sendMessage({
            scope: DB_CONTROL_SCOPE,
            kind: 'ensure-offscreen',
        })
    } catch {
        // SW mid-restart; the send itself wakes it.
    }
}

/**
 * Resolves on the router's ack (see `ConnectionsAck`); throws when nothing
 * answered, meaning no approval surface will ever resolve this request.
 */
export const sendConnectionApprovalRequest = async (
    request: ConnectionApprovalRequest,
): Promise<void> => {
    const response: unknown = await chrome.runtime.sendMessage({
        scope: CONNECTIONS_REQUEST_SCOPE,
        request,
    })
    if (!isConnectionsAck(response)) {
        throw new Error(
            `Connection approval request '${request.kind}' was not acknowledged`,
        )
    }
}

// `Omit` does not distribute over a union, so each variant is stripped of
// `scope` individually to keep its own fields.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never

export type ConnectionsControlCommand = DistributiveOmit<
    ConnectionsControlMessage,
    'scope'
>

// Bounded so a caller's own pairing timeout always loses to a genuine give-up
// here, never to a still-running retry loop.
const CONTROL_ACK_BUDGET_MS = 8000
// Shorter than a fresh offscreen boot (document creation plus DB migrations),
// so a recreated host is caught on its first available tick.
const CONTROL_RETRY_DELAY_MS = 400

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

export type SendConnectionsControlOptions = {
    /**
     * Runs before every attempt. Overridden by the service worker, which owns
     * `chrome.offscreen` directly and would otherwise be pinging itself.
     */
    ensureHost?: () => Promise<void>
    chromeLike?: typeof chrome
}

/**
 * An unanswered send retries within a bounded budget: the host is legitimately
 * absent while the offscreen document is recreated or booting, and it answers
 * synchronously with consumption, so no answer means the command did not run.
 */
export const sendConnectionsControlMessage = async <
    M extends ConnectionsControlCommand,
>(
    message: M,
    options?: SendConnectionsControlOptions,
): Promise<ConnectionsControlResult<M['kind']>> => {
    const chromeLike = options?.chromeLike ?? chrome
    const ensureHost = options?.ensureHost ?? ensureOffscreenHost
    const deadline = Date.now() + CONTROL_ACK_BUDGET_MS
    for (;;) {
        await ensureHost()
        let response: unknown
        try {
            response = await chromeLike.runtime.sendMessage({
                scope: CONNECTIONS_CONTROL_SCOPE,
                ...message,
            })
        } catch {
            // "Receiving end does not exist" is the same transient no-host state as an unanswered send.
            response = undefined
        }
        if (isConnectionsControlResponse(response)) {
            if (response.ok) {
                return response.result as ConnectionsControlResult<M['kind']>
            }
            throw new Error(response.error)
        }
        if (Date.now() + CONTROL_RETRY_DELAY_MS > deadline) {
            throw new Error(
                `Connections control message '${message.kind}' was not handled`,
            )
        }
        await sleep(CONTROL_RETRY_DELAY_MS)
    }
}

export type ConnectionsControlHandler = (
    message: ConnectionsControlMessage,
) => Promise<ConnectionsControlResponse> | ConnectionsControlResponse | null

/**
 * `null` from the handler means "not mine" and leaves the message unanswered so
 * the sender's retry loop sees no host. Untrusted senders never reach the
 * handler: this channel carries `approve-proposal` with caller-chosen accounts.
 */
export const onConnectionsControlMessage = (
    handler: ConnectionsControlHandler,
): (() => void) => {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: ConnectionsControlResponse) => void,
    ): boolean => {
        if (!isTrustedExtensionPageSender(sender)) return false
        if (!isConnectionsControlMessage(message)) return false
        let outcome: ReturnType<ConnectionsControlHandler>
        try {
            outcome = handler(message)
        } catch (error) {
            sendResponse({ ok: false, error: describeError(error) })
            return false
        }
        if (outcome === null) return false
        if (isPromiseLike(outcome)) {
            Promise.resolve(outcome).then(sendResponse, (error: unknown) =>
                sendResponse({ ok: false, error: describeError(error) }),
            )
            return true
        }
        sendResponse(outcome)
        return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
}

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

// Best-effort: every popup closed is the normal steady state, and Chrome
// reports "nobody is listening" as a rejection.
export const broadcastConnectionsEvent = async (
    event: ConnectionsEvent,
): Promise<void> => {
    try {
        await chrome.runtime.sendMessage({
            scope: CONNECTIONS_EVENT_SCOPE,
            event,
        })
    } catch {
        // No UI realm open.
    }
}

// Gated like the control channel: a spoofed event could fabricate an error
// toast, or a proposal, for a pairing the wallet never made.
export const onConnectionsEvent = (
    handler: (event: ConnectionsEvent) => void,
): (() => void) => {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
    ): boolean => {
        if (!isTrustedExtensionPageSender(sender)) return false
        if (!isConnectionsEventMessage(message)) return false
        handler(message.event)
        return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
}
