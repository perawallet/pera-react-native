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

import { decodeFrame } from '@perawallet/wallet-extension-liquid-auth'

type Route = (raw: string) => Promise<string | null>

/**
 * Caps the number of frames buffered before the user confirms the connection,
 * so a hostile dApp can't flood memory between channel-open and confirmation.
 * Excess frames are dropped (the dApp retries after connect anyway).
 */
const MAX_BUFFERED_FRAMES = 32

export type ConfirmationGate = {
    /**
     * Wraps a protocol route so that, before confirmation, frames are buffered
     * (or allowed through if `allowPreConfirm` matches) instead of handled.
     * After {@link markConfirmed}, frames pass straight through.
     */
    gate: (route: Route, allowPreConfirm?: (raw: string) => boolean) => Route
    /** Marks the connection confirmed and flushes the buffered frames. */
    markConfirmed: () => void
    /** True once markConfirmed() has run. */
    isConfirmed: () => boolean
}

/**
 * The pre-confirmation buffer for the Liquid Auth connection flow. Liquid Auth
 * binds the account during the FIDO ceremony, which happens before the user
 * approves the connection, so dApp requests that arrive on the data channel in
 * that window must be held until confirmation (except `discover`, which is
 * safe metadata and lets the dApp render while the user decides).
 *
 * `send` delivers a flushed route's response over the channel.
 */
export const createConfirmationGate = (
    send: (data: string) => void,
): ConfirmationGate => {
    let confirmed = false
    const buffered: { raw: string; route: Route }[] = []

    return {
        gate:
            (route, allowPreConfirm) =>
            async (raw: string): Promise<string | null> => {
                if (confirmed) return route(raw)
                if (allowPreConfirm?.(raw)) return route(raw)
                if (buffered.length < MAX_BUFFERED_FRAMES) {
                    buffered.push({ raw, route })
                }
                return null
            },
        markConfirmed: () => {
            confirmed = true
            for (const { raw, route } of buffered) {
                // Fire-and-forget: a route can be long-lived (it awaits user
                // approval of the request), so awaiting here would block the
                // flush. Responses are pushed over the channel as they resolve.
                void route(raw).then(response => {
                    if (response) send(response)
                })
            }
            buffered.length = 0
        },
        isConfirmed: () => confirmed,
    }
}

/** True when `raw` is an ARC-0027 `discover` request (safe to answer pre-confirm). */
export const isDiscoverRequest = (raw: string): boolean => {
    try {
        const env = decodeFrame(raw) as { reference?: string }
        return env?.reference === 'arc0027:discover:request'
    } catch {
        return false
    }
}
