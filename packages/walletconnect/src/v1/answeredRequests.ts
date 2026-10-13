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

import { logger } from '@perawallet/wallet-core-shared'
import type { ConnectionPersistence } from '@perawallet/wallet-extension-connections'

const PREFIX = 'wc1-answered:'

// Request ids are dApp-generated and unique per request, so evicting the
// oldest only matters for a replay older than this many later answers.
export const MAX_ANSWERED_REQUESTS_PER_SESSION = 100

/**
 * The v1 bridge can redeliver a call request the wallet already answered when
 * a fresh socket subscribes (cold-start restore, a foreground recreate), and
 * the frame carries nothing that marks it as a repeat. Persisted because the
 * replay most often lands right after a restart.
 */
export interface WalletConnectV1AnsweredRequests {
    has(clientId: string, requestId: number): boolean
    /** Never throws: the answer has already reached the dApp. */
    record(clientId: string, requestId: number): void
    forget(clientId: string): void
}

const keyFor = (clientId: string): string => `${PREFIX}${clientId}`

export const createStorageAnsweredRequests = (
    // Resolved per call: the provider may not be configured when the handler
    // is constructed.
    getStorage: () => ConnectionPersistence,
): WalletConnectV1AnsweredRequests => {
    const read = (clientId: string): string[] => {
        const raw = getStorage().getItem(keyFor(clientId))
        if (raw === null) return []
        try {
            const parsed: unknown = JSON.parse(raw)
            return Array.isArray(parsed)
                ? parsed.filter((id): id is string => typeof id === 'string')
                : []
        } catch {
            return []
        }
    }

    return {
        has: (clientId, requestId) => {
            try {
                return read(clientId).includes(String(requestId))
            } catch (error) {
                // Failing open re-presents a possible replay, which is what
                // happened before this guard existed; failing closed could
                // swallow a live request.
                logger.warn('[WC v1] answered-request lookup failed', {
                    clientId,
                    error,
                })
                return false
            }
        },
        record: (clientId, requestId) => {
            try {
                const id = String(requestId)
                const ids = read(clientId)
                if (ids.includes(id)) return
                getStorage().setItem(
                    keyFor(clientId),
                    JSON.stringify(
                        [...ids, id].slice(-MAX_ANSWERED_REQUESTS_PER_SESSION),
                    ),
                )
            } catch (error) {
                logger.warn('[WC v1] recording an answered request failed', {
                    clientId,
                    error,
                })
            }
        },
        forget: clientId => {
            try {
                getStorage().removeItem(keyFor(clientId))
            } catch (error) {
                logger.warn('[WC v1] forgetting answered requests failed', {
                    clientId,
                    error,
                })
            }
        },
    }
}
