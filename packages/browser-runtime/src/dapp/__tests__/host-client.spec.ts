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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDappHostRequest } from '../host-client'
import { DAPP_HOST_REQUEST_SCOPE } from '../dapp-wire'

const message = {
    origin: 'https://a.example',
    hasUserActivation: true,
    returnTo: { tabId: 2 },
    request: { jsonrpc: '2.0' as const, id: 'r', method: 'connect' },
}

describe('sendDappHostRequest', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('ensures the host, stamps the scope and resolves on ack', async () => {
        const sendMessage = vi.fn().mockResolvedValue({ ok: true })
        const ensureHost = vi.fn().mockResolvedValue(undefined)
        await sendDappHostRequest(message, {
            ensureHost,
            chromeLike: {
                runtime: { sendMessage },
            } as unknown as typeof chrome,
        })
        expect(ensureHost).toHaveBeenCalledTimes(1)
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_HOST_REQUEST_SCOPE,
            ...message,
        })
    })

    it('retries an unanswered send until the host appears', async () => {
        const sendMessage = vi
            .fn()
            .mockRejectedValueOnce(new Error('Receiving end does not exist'))
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ ok: true })
        const pending = sendDappHostRequest(message, {
            ensureHost: async () => {},
            chromeLike: {
                runtime: { sendMessage },
            } as unknown as typeof chrome,
        })
        await vi.advanceTimersByTimeAsync(1_000)
        await expect(pending).resolves.toBeUndefined()
        expect(sendMessage).toHaveBeenCalledTimes(3)
    })

    it('gives up once the ack budget is exhausted', async () => {
        const sendMessage = vi.fn().mockResolvedValue(undefined)
        const pending = sendDappHostRequest(message, {
            ensureHost: async () => {},
            chromeLike: {
                runtime: { sendMessage },
            } as unknown as typeof chrome,
        })
        const outcome = pending.then(
            () => 'resolved',
            (e: Error) => e.message,
        )
        await vi.advanceTimersByTimeAsync(10_000)
        expect(await outcome).toBe("dapp request 'connect' was not handled")
    })
})
