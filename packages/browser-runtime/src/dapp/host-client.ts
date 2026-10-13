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
    DAPP_HOST_REQUEST_SCOPE,
    isDappAck,
    type DappHostRequestMessage,
} from './dapp-wire'

// Same budget as the connections control channel: the offscreen host is
// legitimately absent for a moment after the worker wakes it.
const HOST_ACK_BUDGET_MS = 8000
const HOST_RETRY_DELAY_MS = 400

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

/** Service-worker side: forward a verified page request to the offscreen handler, retrying while the host boots. */
export const sendDappHostRequest = async (
    message: Omit<DappHostRequestMessage, 'scope'>,
    options: { ensureHost: () => Promise<void>; chromeLike?: typeof chrome },
): Promise<void> => {
    const chromeLike = options.chromeLike ?? chrome
    const deadline = Date.now() + HOST_ACK_BUDGET_MS
    for (;;) {
        await options.ensureHost()
        let response: unknown
        try {
            response = await chromeLike.runtime.sendMessage({
                scope: DAPP_HOST_REQUEST_SCOPE,
                ...message,
            })
        } catch {
            response = undefined
        }
        if (isDappAck(response)) return
        if (Date.now() + HOST_RETRY_DELAY_MS > deadline) {
            throw new Error(
                `dapp request '${message.request.method}' was not handled`,
            )
        }
        await sleep(HOST_RETRY_DELAY_MS)
    }
}
