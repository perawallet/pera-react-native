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

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLastSigningEvent } from '../useLastSigningEvent'
import { signingEventBus } from '../../pipeline/signingEventBus'
import type { SigningLifecycleEvent } from '../../pipeline/signingEvents'

const req = (id: string) => ({ id, type: 'transactions' }) as never

type StartedEvent = Extract<SigningLifecycleEvent, { type: 'started' }>
type CompletedEvent = Extract<SigningLifecycleEvent, { type: 'completed' }>

const isStarted = (e: SigningLifecycleEvent): e is StartedEvent =>
    e.type === 'started'
const isCompleted = (e: SigningLifecycleEvent): e is CompletedEvent =>
    e.type === 'completed'

afterEach(() => signingEventBus.__resetForTests())

describe('useLastSigningEvent', () => {
    it('returns null when no requestId is passed and no live events have arrived', () => {
        const { result } = renderHook(() => useLastSigningEvent(isStarted))
        expect(result.current).toBeNull()
    })

    it('returns null when requestId points to no retained events', () => {
        const { result } = renderHook(() =>
            useLastSigningEvent(isStarted, 'missing-request'),
        )
        expect(result.current).toBeNull()
    })

    it('seeds from history with the most-recent matching event (iterates from the end)', () => {
        // Publish two `started` events for the same request — the hook should
        // pick the last one when seeding lazily on mount.
        const first = { type: 'started', request: req('r1') } as StartedEvent
        const second = { type: 'started', request: req('r1') } as StartedEvent
        signingEventBus.publish(first)
        signingEventBus.publish({
            type: 'completed',
            request: req('r1'),
            result: { type: 'algod', txIds: [] } as never,
        })
        signingEventBus.publish(second)

        const { result } = renderHook(() =>
            useLastSigningEvent(isStarted, 'r1'),
        )
        expect(result.current).toBe(second)
    })

    it('updates state when a matching live event arrives for the same requestId', () => {
        const { result } = renderHook(() =>
            useLastSigningEvent(isCompleted, 'r1'),
        )
        expect(result.current).toBeNull()

        const completed = {
            type: 'completed',
            request: req('r1'),
            result: { type: 'algod', txIds: [] } as never,
        } as CompletedEvent
        act(() => signingEventBus.publish(completed))

        expect(result.current).toBe(completed)
    })

    it('ignores events that do not match the predicate', () => {
        const { result } = renderHook(() =>
            useLastSigningEvent(isCompleted, 'r1'),
        )
        act(() =>
            signingEventBus.publish({ type: 'started', request: req('r1') }),
        )
        expect(result.current).toBeNull()
    })

    it('ignores events for a different requestId when requestId is given', () => {
        const { result } = renderHook(() =>
            useLastSigningEvent(isStarted, 'r1'),
        )
        act(() =>
            signingEventBus.publish({ type: 'started', request: req('r2') }),
        )
        expect(result.current).toBeNull()
    })

    it('without requestId, accepts live events from any request', () => {
        const { result } = renderHook(() => useLastSigningEvent(isStarted))

        const first = { type: 'started', request: req('rA') } as StartedEvent
        act(() => signingEventBus.publish(first))
        expect(result.current).toBe(first)

        const second = { type: 'started', request: req('rB') } as StartedEvent
        act(() => signingEventBus.publish(second))
        expect(result.current).toBe(second)
    })
})
