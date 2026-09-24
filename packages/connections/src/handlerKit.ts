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

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    ConnectionId,
    ConnectionKind,
    ConnectionOrigin,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type { ConnectionHandlerContext } from './handler'
import type { ConnectionErrorScope } from './models'

export const pairingScope = (pairingId: string): ConnectionErrorScope => ({
    pairingId,
})

export const connectionScope = (id: ConnectionId): ConnectionErrorScope => ({
    connectionId: id,
})

/**
 * Origins handed to `pair()`, held until a session settles and there is a
 * record to write them onto. Keyed by whatever the handler calls a pairing.
 */
export interface PendingOrigins {
    get(pairingId: string): ConnectionOrigin | undefined
    /** No origin clears the entry, so a re-pairing never inherits a stale one. */
    remember(pairingId: string, origin?: ConnectionOrigin): void
    forget(pairingId: string): void
}

export type HandlerKitOptions = {
    /** Prefix on the warnings the kit logs, e.g. `[WC v1]`. */
    logTag: string
    /**
     * What a call before `initialize()` throws. Defaults to a plain `Error`;
     * a protocol passes its own class so the failure classifies like its others.
     */
    notInitializedError?: () => Error
    /** Log fields naming a connection in the kit's warnings. Defaults to `{ connectionId }`. */
    activityLogFields?: (id: ConnectionId) => Record<string, unknown>
}

/** The scaffolding every `ConnectionHandler` closure otherwise repeats. */
export interface HandlerKit {
    attach(context: ConnectionHandlerContext): void
    /** Drops the context and every pending origin, as `teardown()` must. */
    detach(): void
    /** For the callbacks that may fire after teardown and must then do nothing. */
    currentContext(): Nullable<ConnectionHandlerContext>
    requireContext(): ConnectionHandlerContext
    store(): ConnectionStoreAPI
    /** Logs, then tells the registry. Safe after teardown, when only the log happens. */
    reportError(error: unknown, scope?: ConnectionErrorScope): void
    /**
     * Stamps `lastActiveAt` without blocking the caller; failures are logged,
     * never thrown. Requests are user-paced, so no debounce.
     */
    recordActivity(id: ConnectionId): void
    readonly pendingOrigins: PendingOrigins
}

const toError = (value: unknown): Error =>
    value instanceof Error ? value : new Error(String(value))

export const createHandlerKit = (
    kind: ConnectionKind,
    options: HandlerKitOptions,
): HandlerKit => {
    const {
        logTag,
        notInitializedError = () =>
            new Error(`The ${kind} handler was used before initialize()`),
        activityLogFields = (id: ConnectionId) => ({ connectionId: id }),
    } = options

    let context: Nullable<ConnectionHandlerContext> = null
    const origins = new Map<string, ConnectionOrigin>()

    const requireContext = (): ConnectionHandlerContext => {
        if (!context) throw notInitializedError()
        return context
    }

    const store = (): ConnectionStoreAPI => requireContext().store

    // Re-read first so a disconnect that already landed is not undone; a
    // remove that lands between the read and the write can still be, and the
    // next reconcile drops it.
    const recordActivity = (id: ConnectionId): void => {
        void (async () => {
            const current = await store().get(id)
            if (!current) return
            await store().upsert({ ...current, lastActiveAt: Date.now() })
        })().catch((error: unknown) => {
            logger.warn(`${logTag} failed to record connection activity`, {
                ...activityLogFields(id),
                error,
            })
        })
    }

    return {
        attach: next => {
            context = next
        },
        detach: () => {
            context = null
            origins.clear()
        },
        currentContext: () => context,
        requireContext,
        store,
        reportError: (error, scope) => {
            const normalized = toError(error)
            logger.error(normalized, scope)
            context?.onError(normalized, scope)
        },
        recordActivity,
        pendingOrigins: {
            get: pairingId => origins.get(pairingId),
            remember: (pairingId, origin) => {
                if (origin) origins.set(pairingId, origin)
                else origins.delete(pairingId)
            },
            forget: pairingId => {
                origins.delete(pairingId)
            },
        },
    }
}
