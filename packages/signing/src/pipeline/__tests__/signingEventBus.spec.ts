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
import { createSigningEventBus } from '../signingEventBus'
import type { SigningLifecycleEvent } from '../signingEvents'

const req = (id: string) => ({ id, type: 'transactions' }) as never

describe('createSigningEventBus', () => {
    it('publishes events to all subscribers in order', () => {
        const bus = createSigningEventBus()
        const handler = vi.fn()
        bus.subscribe(handler)

        const ev1: SigningLifecycleEvent = {
            type: 'started',
            request: req('r1'),
        }
        const ev2: SigningLifecycleEvent = {
            type: 'awaiting-user',
            request: req('r1'),
        }
        bus.publish(ev1)
        bus.publish(ev2)

        expect(handler).toHaveBeenNthCalledWith(1, ev1)
        expect(handler).toHaveBeenNthCalledWith(2, ev2)
    })

    it('retains events per request id for replay', () => {
        const bus = createSigningEventBus()
        bus.publish({ type: 'started', request: req('r1') })
        bus.publish({ type: 'awaiting-user', request: req('r1') })
        bus.publish({ type: 'started', request: req('r2') })

        expect(bus.replay('r1')).toHaveLength(2)
        expect(bus.replay('r2')).toHaveLength(1)
    })

    it('drops retained events when releaseRequest is called', () => {
        const bus = createSigningEventBus()
        bus.publish({ type: 'started', request: req('r1') })
        bus.releaseRequest('r1')

        expect(bus.replay('r1')).toHaveLength(0)
    })

    it('unsubscribe stops further deliveries', () => {
        const bus = createSigningEventBus()
        const handler = vi.fn()
        const unsubscribe = bus.subscribe(handler)
        bus.publish({ type: 'started', request: req('r1') })
        unsubscribe()
        bus.publish({ type: 'awaiting-user', request: req('r1') })

        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('subscribeWithReplay receives retained events on subscribe', () => {
        const bus = createSigningEventBus()
        bus.publish({ type: 'started', request: req('r1') })
        bus.publish({ type: 'awaiting-user', request: req('r1') })

        const handler = vi.fn()
        bus.subscribeWithReplay('r1', handler)

        expect(handler).toHaveBeenCalledTimes(2)
        expect(handler.mock.calls[0][0].type).toBe('started')
        expect(handler.mock.calls[1][0].type).toBe('awaiting-user')
    })
})
