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

import { describe, it, expect, vi } from 'vitest'
import { createDisableHandler } from '../handlers/disable'

describe('disable handler', () => {
    it('returns the session id and defers teardown until after the ack', async () => {
        vi.useFakeTimers()
        const teardown = vi.fn()
        const handler = createDisableHandler({ sessionId: 's1', teardown })
        const result = await handler({
            id: 'r',
            reference: 'arc0027:disable:request',
        })
        // Teardown is deferred so the ack can flush over the still-open channel.
        expect(teardown).not.toHaveBeenCalled()
        expect(result).toEqual({ sessionIds: ['s1'] })

        vi.runAllTimers()
        expect(teardown).toHaveBeenCalledWith('s1')
        vi.useRealTimers()
    })
})
