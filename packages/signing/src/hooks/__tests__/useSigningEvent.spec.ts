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

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSigningEvent } from '../useSigningEvent'
import { signingEventBus } from '../../pipeline/signingEventBus'

const req = (id: string) => ({ id, type: 'transactions' }) as never

afterEach(() => signingEventBus.__resetForTests())

describe('useSigningEvent', () => {
    it('invokes handler for matching live events', () => {
        const handler = vi.fn()
        renderHook(() => useSigningEvent(e => e.type === 'completed', handler))
        signingEventBus.publish({ type: 'started', request: req('r1') })
        signingEventBus.publish({
            type: 'completed',
            request: req('r1'),
            result: { type: 'algod', txIds: [] } as never,
        })
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0][0].type).toBe('completed')
    })

    it('replays history when options.replay is true and requestId is set', () => {
        signingEventBus.publish({ type: 'started', request: req('r1') })
        const handler = vi.fn()
        renderHook(() =>
            useSigningEvent(e => e.type === 'started', handler, {
                replay: true,
                requestId: 'r1',
            }),
        )
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not invoke handler for non-matching predicate', () => {
        const handler = vi.fn()
        renderHook(() => useSigningEvent(e => e.type === 'rejected', handler))
        signingEventBus.publish({ type: 'started', request: req('r1') })
        expect(handler).not.toHaveBeenCalled()
    })
})
